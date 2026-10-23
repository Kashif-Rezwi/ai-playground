import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import type { Approval, Run, RunStatus, Message } from '../utils/types.js';
import CONFIG from '../utils/config.js';

// ── Event bus ─────────────────────────────────────────────────────────────
// SSE controllers subscribe here. The service layer never knows about HTTP.
// Events: 'run_started', 'approval_required', 'approval_decided', 'run_status_changed', 'run_completed', 'run_failed'
export const runEvents = new EventEmitter();

// In-memory store
const runs = new Map<string, Run>();

const approvalService = {

    // Create a new Run and persist it. Returns the Run so the caller can
    // hand back the runId to the client immediately.
    createRun(params: {
        conversationHistory: Message[];
        temperature: number;
        maxTokens: number;
        topP: number;
    }): Run {
        const run: Run = {
            runId: uuidv4(),
            status: 'running',
            conversationHistory: params.conversationHistory,
            approvals: [],
            createdAt: Date.now(),
            tokenCount: 0,
            retries: 0,
            temperature: params.temperature,
            maxTokens: params.maxTokens,
            topP: params.topP,
        };
        runs.set(run.runId, run);
        runEvents.emit('run_started', { runId: run.runId });
        return run;
    },

    // Attach a new pending Approval to an existing Run.
    // Called once per tool call that requires human sign-off.
    createApproval(
        runId: string,
        toolCallId: string,
        toolName: string,
        toolArguments: string,
    ): Approval {
        const run = runs.get(runId);
        if (!run) throw new Error(`Run ${runId} not found`);

        const now = Date.now();
        const approval: Approval = {
            approvalId: uuidv4(),
            runId,
            toolCallId,
            toolName,
            toolArguments,
            status: 'pending',
            createdAt: now,
            expiresAt: now + CONFIG.APPROVAL_TTL_MS,
        };

        run.approvals.push(approval);
        runEvents.emit('approval_required', {
            runId,
            approval: { approvalId: approval.approvalId, toolName, toolArguments, expiresAt: approval.expiresAt },
        });
        return approval;
    },

    // Simple getters — consumers should treat these as read-only.
    getRun(runId: string): Run | undefined {
        return runs.get(runId);
    },

    // Scans every run's approval list so callers don't need to know the runId.
    getApproval(approvalId: string): Approval | undefined {
        for (const run of runs.values()) {
            const found = run.approvals.find(a => a.approvalId === approvalId);
            if (found) return found;
        }
        return undefined;
    },

    // Mutate the top-level status of a run (e.g. running → pending_approval → completed).
    updateRunStatus(runId: string, status: RunStatus): void {
        const run = runs.get(runId);
        if (!run) throw new Error(`Run ${runId} not found`);
        run.status = status;
        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
            run.completedAt = Date.now();
        }
        runEvents.emit('run_status_changed', { runId, status, finalAnswer: run.finalAnswer, error: run.error });
    },

    // Record a human decision on a single approval.
    // Returns the updated Approval, or null if not found / already decided.
    decideApproval(approvalId: string, decision: 'approved' | 'rejected'): Approval | null {
        const approval = approvalService.getApproval(approvalId);
        if (!approval || approval.status !== 'pending') return null;

        approval.status = decision;
        approval.decidedAt = Date.now();
        runEvents.emit('approval_decided', { runId: approval.runId, approvalId, decision });
        return approval;
    },

    // Returns true only when every approval for a run has reached a terminal state
    // (approved | rejected | expired). Used by the orchestration layer to know it
    // can move forward.
    allApprovalsFinalFor(runId: string): boolean {
        const run = runs.get(runId);
        if (!run) return false;
        const pending = ['pending'] as const;
        return run.approvals.every(a => !pending.includes(a.status as 'pending'));
    },

    // Mark any approval whose TTL has passed as 'expired'.
    // Call this before checking decisions so the orchestrator sees fresh state.
    expireStaleApprovals(): void {
        const now = Date.now();
        for (const run of runs.values()) {
            for (const approval of run.approvals) {
                if (approval.status === 'pending' && now > approval.expiresAt) {
                    approval.status = 'expired';
                }
            }
        }
    },
};

export default approvalService;
