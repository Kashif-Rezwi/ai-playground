import CONFIG from '../utils/config.js';
import type { GenerateChatRequest, Message } from '../utils/types.js';
import { TOOLS } from '../tools/registry.js';
import { executeToolBatch } from '../utils/tool-loop.js';
import createChatWithToolCallRetry from './llm.service.js';
import approvalService from './approval.service.js';
import type { Run } from '../utils/types.js';

const chatService = {
  // Start a chat run. If the model requests tool calls, the run is paused
  // and returned with status 'pending_approval'. The caller must poll the
  // run and POST decisions before calling resumeRun().
  async startRun(request: GenerateChatRequest): Promise<Run> {
    const {
      systemPrompt = '',
      userPrompt,
      temperature = CONFIG.TEMPERATURE,
      maxTokens = CONFIG.MAX_TOKENS,
      topP = CONFIG.TOP_P,
    } = request;

    const history: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const run = approvalService.createRun({ conversationHistory: history, temperature, maxTokens, topP });

    // Do the first LLM call immediately.
    await chatService._advanceRun(run);
    return approvalService.getRun(run.runId)!;
  },

  // Resume a run after all approvals are decided.
  // Executes approved calls, inserts rejection results, then calls the model again.
  async resumeRun(runId: string): Promise<Run> {
    const run = approvalService.getRun(runId);
    if (!run) throw new Error(`Run ${runId} not found`);
    if (run.status !== 'pending_approval') throw new Error(`Run ${runId} is not pending approval`);

    // Expire any stale approvals first, then check all are final
    approvalService.expireStaleApprovals();
    if (!approvalService.allApprovalsFinalFor(runId)) {
      throw new Error(`Not all approvals are decided for run ${runId}`);
    }

    // The assistant tool-call message is already in history.
    // Now append one tool result per call in original order.
    const pendingApprovals = run.approvals.filter(a =>
      // Only the approvals from this batch (those without a result yet)
      // We identify them by checking that the tool_call_id is not yet in history
      !run.conversationHistory.some(
        msg => msg.role === 'tool' && (msg as { tool_call_id?: string }).tool_call_id === a.toolCallId
      )
    );

    for (const approval of pendingApprovals) {
      if (approval.status === 'approved') {
        // Find the matching tool call from the last assistant message
        const assistantMsg = [...run.conversationHistory].reverse().find(m => m.role === 'assistant');
        const toolCall = (assistantMsg as any)?.tool_calls?.find((tc: any) => tc.id === approval.toolCallId);
        const toolName = toolCall?.function?.name ?? approval.toolName;
        const toolArgs = toolCall?.function?.arguments ?? approval.toolArguments;

        let result: string;
        try {
          const { executeTool } = await import('../tools/registry.js');
          result = executeTool(toolName, toolArgs);
        } catch {
          result = JSON.stringify({ error: 'Tool execution failed unexpectedly.' });
        }
        run.conversationHistory.push({ role: 'tool', tool_call_id: approval.toolCallId, content: result });
        console.log(`[TOOL:APPROVED] ${approval.toolCallId} (${toolName}) -> ${result}`);
      } else {
        // Rejected or expired — still needs a result so history stays valid
        run.conversationHistory.push({
          role: 'tool',
          tool_call_id: approval.toolCallId,
          content: JSON.stringify({
            status: approval.status,
            reason: `The user ${approval.status} this tool call.`,
          }),
        });
        console.log(`[TOOL:${approval.status.toUpperCase()}] ${approval.toolCallId} (${approval.toolName})`);
      }
    }

    // Update run status before re-calling the model
    const anyRejected = pendingApprovals.some(a => a.status === 'rejected' || a.status === 'expired');
    approvalService.updateRunStatus(runId, anyRejected ? 'rejected' : 'running');

    await chatService._advanceRun(run);
    return approvalService.getRun(runId)!;
  },

  // Internal: call the model and handle the response.
  // If the model wants tools → create approvals and pause.
  // If the model gives a final answer → mark completed.
  async _advanceRun(run: Run): Promise<void> {
    const retryStats = { retries: 0 };

    let iterations = 0;

    while (true) {
      const rawResponse = await createChatWithToolCallRetry(
        {
          model: CONFIG.MODEL,
          messages: run.conversationHistory,
          tools: TOOLS,
          tool_choice: CONFIG.TOOL_CHOICE,
          max_tokens: run.maxTokens,
          temperature: run.temperature,
          top_p: run.topP,
        },
        retryStats,
      );

      run.tokenCount += rawResponse?.usage?.total_tokens ?? 0;
      run.retries = retryStats.retries;

      const assistantMessage = rawResponse.choices[0].message;

      // No tool calls → final answer
      if (
        rawResponse.choices[0].finish_reason !== 'tool_calls' ||
        !assistantMessage.tool_calls?.length
      ) {
        run.conversationHistory.push({ role: 'assistant', content: assistantMessage.content ?? '' });
        run.finalAnswer = assistantMessage.content ?? '';
        approvalService.updateRunStatus(run.runId, 'completed');
        return;
      }

      // Tool calls requested — save assistant message (with tool_calls) to history
      run.conversationHistory.push(assistantMessage);

      iterations += 1;
      if (iterations >= CONFIG.MAX_TOOL_ITERATIONS) {
        const note = `Tool iteration limit (${CONFIG.MAX_TOOL_ITERATIONS}) reached.`;
        console.warn(note);
        run.conversationHistory.push({ role: 'assistant', content: note });
        run.finalAnswer = note;
        approvalService.updateRunStatus(run.runId, 'completed');
        return;
      }

      // Create one pending approval per tool call, then pause for human decisions
      for (const toolCall of assistantMessage.tool_calls) {
        approvalService.createApproval(
          run.runId,
          toolCall.id,
          toolCall.function.name,
          toolCall.function.arguments,
        );
      }

      approvalService.updateRunStatus(run.runId, 'pending_approval');
      console.log(`[RUN] ${run.runId} paused — ${assistantMessage.tool_calls.length} approval(s) required`);
      return; // Yield control back to the HTTP layer
    }
  },
};

export default chatService;
