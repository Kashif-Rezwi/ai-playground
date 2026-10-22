import { v4 as uuidv4 } from 'uuid';
import type { Approval, ApprovalStatus, Run, RunStatus, Message } from '../utils/types.js';
import CONFIG from '../utils/config.js';

// In-memory store
const runs = new Map<string, Run>();

const approvalService = {
    createRun(params: { conversationHistory: Message[], temperature: number, maxTokens: number, topP: number }): Run { return },

    createApproval(runId: string, toolCallId: string, toolName: string, toolArguments: string): Approval { return },

    getRun(runId: string): Run | undefined { return },

    getApproval(approvalId: string): Approval | undefined { return },  // searches across all runs

    updateRunStatus(runId: string, status: RunStatus): void { return },

    decideApproval(approvalId: string, decision: 'approved' | 'rejected'): Approval | null { return },

    allApprovalsFinalFor(runId: string): boolean { return },

    expireStaleApprovals(): void { return },  // call this before any decision check
};

export default approvalService;
