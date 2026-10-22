import type { Request, Response } from 'express';
import { z } from 'zod';
import CONFIG from '../utils/config.js';
import { SYSTEM_PROMPT } from '../utils/prompts.js';
import chatService from '../services/chat.service.js';
import approvalService, { runEvents } from '../services/approval.service.js';

// ── Request validation ─────────────────────────────────────────────────────

const generateSchema = z.object({
  systemPrompt: z.string().optional(),
  userPrompt: z.string().trim().min(1, 'userPrompt is required'),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
});

// ── Sanitized run view ────────────────────────────────────────────────────
// Never expose the raw internal Run directly. Map only what clients need.

function sanitizeRun(run: ReturnType<typeof approvalService.getRun>) {
  if (!run) return null;
  return {
    runId: run.runId,
    status: run.status,
    approvals: run.approvals.map(a => ({
      approvalId: a.approvalId,
      toolName: a.toolName,
      toolArguments: a.toolArguments,
      status: a.status,
      createdAt: a.createdAt,
      expiresAt: a.expiresAt,
    })),
    finalAnswer: run.finalAnswer,
    tokenCount: run.tokenCount,
    retries: run.retries,
    createdAt: run.createdAt,
    completedAt: run.completedAt,
    error: run.error,
  };
}

// ── Controller ────────────────────────────────────────────────────────────

const chatController = {
  // POST /api/chat/generate
  // Starts a run. Returns 202 if pending approval, 200 if immediately completed.
  async generate(req: Request, res: Response): Promise<Response> {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const {
      systemPrompt = SYSTEM_PROMPT,
      userPrompt,
      temperature = CONFIG.TEMPERATURE,
      maxTokens = CONFIG.MAX_TOKENS,
      topP = CONFIG.TOP_P,
    } = parsed.data;

    try {
      const run = await chatService.startRun({ systemPrompt, userPrompt, temperature, maxTokens, topP });
      return res.status(run.status === 'completed' ? 200 : 202).json(sanitizeRun(run));
    } catch (error) {
      console.error('[generate]', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  },

  // GET /api/chat/runs/:runId
  // Fetch the current sanitized state of a run.
  async getRun(req: Request, res: Response): Promise<Response> {
    approvalService.expireStaleApprovals();
    const run = approvalService.getRun(req.params.runId as string);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    return res.status(200).json(sanitizeRun(run));
  },

  // GET /api/chat/runs/:runId/stream
  // SSE stream — client keeps this connection open to receive live events.
  // The connection closes automatically when the run reaches a terminal state.
  // If the connection drops early, the client should poll GET /runs/:runId.
  async streamRun(req: Request, res: Response): Promise<void> {
    const runId = req.params.runId as string;

    approvalService.expireStaleApprovals();
    const run = approvalService.getRun(runId);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    // SSE headers — must be sent before any writes
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Helper: write one SSE frame
    const send = (event: string, data: object) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Send current state immediately so the client isn't blind on connect
    send('run_state', sanitizeRun(run)!);

    // ── Subscribe to events for this specific runId ──────────────────────

    const onApprovalRequired = (payload: { runId: string; approval: object }) => {
      if (payload.runId !== runId) return;
      send('approval_required', payload.approval);
    };

    const onApprovalDecided = (payload: { runId: string; approvalId: string; decision: string }) => {
      if (payload.runId !== runId) return;
      send('approval_decided', { approvalId: payload.approvalId, decision: payload.decision });
    };

    const onStatusChanged = (payload: { runId: string; status: string; finalAnswer?: string; error?: string }) => {
      if (payload.runId !== runId) return;
      send('run_status_changed', { status: payload.status, finalAnswer: payload.finalAnswer, error: payload.error });

      // Terminal states → close the stream
      const terminal = ['completed', 'rejected', 'failed', 'cancelled', 'expired'];
      if (terminal.includes(payload.status)) {
        send('done', {});
        cleanup();
        res.end();
      }
    };

    runEvents.on('approval_required', onApprovalRequired);
    runEvents.on('approval_decided', onApprovalDecided);
    runEvents.on('run_status_changed', onStatusChanged);

    // ── Cleanup: remove listeners when client disconnects ────────────────
    const cleanup = () => {
      runEvents.off('approval_required', onApprovalRequired);
      runEvents.off('approval_decided', onApprovalDecided);
      runEvents.off('run_status_changed', onStatusChanged);
    };

    req.on('close', cleanup);
  },

  // POST /api/chat/approvals/:approvalId/approve
  async approve(req: Request, res: Response): Promise<Response> {
    return chatController._decide(req, res, 'approved');
  },

  // POST /api/chat/approvals/:approvalId/reject
  async reject(req: Request, res: Response): Promise<Response> {
    return chatController._decide(req, res, 'rejected');
  },

  // Internal helper shared by approve() and reject()
  async _decide(req: Request, res: Response, decision: 'approved' | 'rejected'): Promise<Response> {
    approvalService.expireStaleApprovals();

    const approval = approvalService.getApproval(req.params.approvalId as string);
    if (!approval) return res.status(404).json({ error: 'Approval not found' });

    // Idempotency: already decided → return recorded state, no re-execution
    if (approval.status !== 'pending') {
      return res.status(200).json({ approval, message: `Already ${approval.status}` });
    }

    // Expired at TTL check
    if (Date.now() > approval.expiresAt) {
      return res.status(409).json({ error: 'Approval has expired and can no longer be decided' });
    }

    const decided = approvalService.decideApproval(approval.approvalId, decision);
    if (!decided) return res.status(409).json({ error: 'Could not record decision' });

    // If the entire batch for this run is now terminal, resume the run automatically
    if (approvalService.allApprovalsFinalFor(approval.runId)) {
      try {
        const run = await chatService.resumeRun(approval.runId);
        return res.status(200).json({ approval: decided, run: sanitizeRun(run) });
      } catch (error) {
        console.error('[resume]', error);
        return res.status(500).json({ error: error instanceof Error ? error.message : 'Resume failed' });
      }
    }

    // Still waiting for other approvals in the batch
    return res.status(200).json({ approval: decided, message: 'Waiting for remaining approvals in this batch' });
  },
};

export default chatController;
