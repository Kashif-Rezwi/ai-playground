import type { Request, Response } from 'express';
import { z } from 'zod';
import CONFIG from '../utils/config.js';
import { SYSTEM_PROMPT } from '../utils/prompts.js';
import chatService from '../services/chat.service.js';
import approvalService from '../services/approval.service.js';

// ── Request validation ─────────────────────────────────────────────────────

const generateSchema = z.object({
  systemPrompt: z.string().optional(),
  userPrompt: z.string().trim().min(1, 'userPrompt is required'),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
});

// ── Controller ────────────────────────────────────────────────────────────

const chatController = {
  // POST /api/chat/generate
  // Starts a run. Returns immediately — either completed or pending_approval.
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
      return res.status(run.status === 'completed' ? 200 : 202).json(run);
    } catch (error) {
      console.error('[generate]', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  },

  // GET /api/chat/runs/:runId
  // Fetch the current state of a run (including its approvals).
  async getRun(req: Request, res: Response): Promise<Response> {
    const run = approvalService.getRun(req.params.runId as string);
    if (!run) return res.status(404).json({ error: 'Run not found' });

    // Expire stale approvals so callers always see fresh state
    approvalService.expireStaleApprovals();
    return res.status(200).json(run);
  },

  // POST /api/chat/approvals/:approvalId/approve
  // Approve a single pending tool call. If all approvals in the batch are
  // now terminal, automatically resume the run.
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

    // Idempotency: if already decided, return the recorded state
    if (approval.status !== 'pending') {
      return res.status(200).json({ approval, message: `Already ${approval.status}` });
    }

    const decided = approvalService.decideApproval(approval.approvalId, decision);
    if (!decided) return res.status(409).json({ error: 'Could not record decision' });

    // If the entire batch for this run is now terminal, resume automatically
    if (approvalService.allApprovalsFinalFor(approval.runId)) {
      try {
        const run = await chatService.resumeRun(approval.runId);
        return res.status(200).json({ approval: decided, run });
      } catch (error) {
        console.error('[resume]', error);
        return res.status(500).json({ error: error instanceof Error ? error.message : 'Resume failed' });
      }
    }

    // Still waiting for other approvals in the batch
    return res.status(200).json({ approval: decided, message: 'Waiting for remaining approvals' });
  },
};

export default chatController;
