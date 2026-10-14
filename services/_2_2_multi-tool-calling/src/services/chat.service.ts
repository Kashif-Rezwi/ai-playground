import { APIError } from "groq-sdk";
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from "groq-sdk/resources/chat/completions";
import CONFIG from "../utils/config";
import { GenerateChatRequest, GenerateChatResponse, Message, ToolTrace } from "../utils/types";
import { TOOLS } from "../tools/registry";
import { executeToolBatch } from "../utils/tool-loop";
import groqClient from "./llm.service";

let conversationHistory: Message[] = [];

// Helper function to extract the failed_generation reason from a 400 APIError, if present.
function getFailedGenerationReason(error: unknown): string | null {
    if (!(error instanceof APIError) || error.status !== 400) return null;

    const body = error.error as { error?: { failed_generation?: unknown } } | null;
    const failedGeneration = body?.error?.failed_generation;
    if (!failedGeneration) return null;

    // The SDK types it as string | null, but the docs show an object { reason, tool_call_id, attempted_arguments }
    return typeof failedGeneration === "string" ? failedGeneration : JSON.stringify(failedGeneration);
}

// Retry wrapper for groqClient.chat.completions.create() that handles failed tool-call generations.
async function createChatWithToolCallRetry(
    params: ChatCompletionCreateParamsNonStreaming,
    stats: { retries: number }
): Promise<ChatCompletion> {
    let temperature = params.temperature ?? CONFIG.TEMPERATURE;

    for (let attempt = 1; attempt <= CONFIG.MAX_TOOL_CALL_RETRIES; attempt++) {
        try {
            return await groqClient.chat.completions.create({ ...params, temperature });
        } catch (error) {
            const failedGeneration = getFailedGenerationReason(error);

            // Not a failed tool-call generation → let it propagate untouched
            if (failedGeneration === null) throw error;

            // Retries exhausted → fail loudly
            if (attempt === CONFIG.MAX_TOOL_CALL_RETRIES) {
                throw new Error(
                    `Failed to generate valid tool calls after ${attempt} attempts. Last failure: ${failedGeneration}`
                );
            }

            // Lower temperature for the next attempt to reduce hallucinations
            temperature = Math.max(Number((temperature - CONFIG.TEMPERATURE_RETRY_STEP).toFixed(1)), CONFIG.MIN_TEMPERATURE);
            stats.retries += 1;
            console.warn(
                `[RETRY ${stats.retries}/${CONFIG.MAX_TOOL_CALL_RETRIES - 1}] tool call generation failed (${failedGeneration}) — re-sending with temperature ${temperature}…`
            );
        }
    }

    // Unreachable — the loop either returns or throws
    throw new Error("Failed to generate valid tool calls.");
}

const chatService = {
    async generateText({ systemPrompt, userPrompt, temperature, maxTokens, topP }: GenerateChatRequest): Promise<GenerateChatResponse> {
        const startedAt = Date.now();

        // Initialize conversation history if empty, then append the user prompt
        if (conversationHistory.length === 0) {
            conversationHistory.push({ role: "system", content: systemPrompt ?? "" });
        }

        // Append the user prompt to the conversation history
        conversationHistory.push({ role: "user", content: userPrompt });

        // Initialize counters and traces
        let inputTokens = 0;
        let outputTokens = 0;
        const toolTraces: ToolTrace[] = [];
        let iterations = 0; // model→tool rounds this turn (guarded by MAX_TOOL_ITERATIONS)
        const stats = { retries: 0 }; // failed tool-call generations retried this turn

        // If tool_calls, execute ALL of them → feed results back → call again.
        // Parallel tool calls arrive as one assistant message with multiple tool_calls entries.
        while (true) {
            const rawResponse = await createChatWithToolCallRetry({
                model: CONFIG.MODEL,
                messages: conversationHistory,
                tools: TOOLS,
                tool_choice: CONFIG.TOOL_CHOICE,
                max_tokens: maxTokens,
                temperature,
                top_p: topP,
            }, stats);

            inputTokens += rawResponse.usage?.prompt_tokens ?? 0;
            outputTokens += rawResponse.usage?.completion_tokens ?? 0;

            const assistantMessage = rawResponse.choices[0].message;

            // Branch on finish_reason, never on content (content is null on tool calls)
            if (rawResponse.choices[0].finish_reason !== "tool_calls" || !assistantMessage.tool_calls?.length) {
                conversationHistory.push({ role: "assistant", content: assistantMessage.content ?? "" });
                
                // Return the last tool trace if any, otherwise null
                const lastTool = toolTraces.length > 0 ? toolTraces[toolTraces.length - 1] : null;
                return {
                    messages: conversationHistory,
                    tokenCount: inputTokens + outputTokens, // a tool turn costs 2+ API calls
                    tool: lastTool,
                    tools: toolTraces,
                    iterations,
                    retries: stats.retries,
                    finishReason: rawResponse.choices[0].finish_reason,
                    totalLatencyMs: Date.now() - startedAt,
                };
            }

            // Record and execute the complete batch before deciding whether another model
            // iteration is allowed. Every tool call must receive a result message.
            iterations += 1;
            conversationHistory.push(assistantMessage);

            // Iterate over EVERY tool call — parallel or sequential.
            const batchTraces = executeToolBatch(assistantMessage.tool_calls, (message) => {
                conversationHistory.push(message);
                if (message.role === "tool") {
                    console.log(`[TOOL] Result: ${message.content}`);
                }
            });
            toolTraces.push(...batchTraces);

            if (iterations >= CONFIG.MAX_TOOL_ITERATIONS) {
                const note = `Tool iteration limit (${CONFIG.MAX_TOOL_ITERATIONS}) reached — stopping to avoid an infinite loop.`;
                console.warn(note);
                conversationHistory.push({ role: "assistant", content: note });
                return {
                    messages: conversationHistory,
                    tokenCount: inputTokens + outputTokens,
                    tool: toolTraces.length > 0 ? toolTraces[toolTraces.length - 1] : null,
                    tools: toolTraces,
                    iterations,
                    retries: stats.retries,
                    finishReason: "length",
                    totalLatencyMs: Date.now() - startedAt,
                };
            }
        }
    },

    async getConversationHistory(): Promise<Message[]> {
        return conversationHistory;
    },

    async clearHistory(): Promise<void> {
        // Reset the in-memory conversation history.
        conversationHistory = [];
    }
};

export default chatService;