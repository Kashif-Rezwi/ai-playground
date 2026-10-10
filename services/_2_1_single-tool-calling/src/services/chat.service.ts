import CONFIG from "../utils/config";
import { GenerateChatRequest, GenerateChatResponse, Message, ToolTrace } from "../utils/types";
import { executeTool, TOOLS } from "../tools/registry";
import groqClient from "./llm.service";

let conversationHistory: Message[] = [];

const chatService = {
    async generateText({ systemPrompt, userPrompt, temperature, maxTokens, topP }: GenerateChatRequest): Promise<GenerateChatResponse> {
        const startedAt = Date.now();

        // Initialize conversation history if empty, then append the user prompt
        if (conversationHistory.length === 0) {
            conversationHistory.push({ role: "system", content: systemPrompt });
        }
        conversationHistory.push({ role: "user", content: userPrompt });

        let inputTokens = 0;
        let outputTokens = 0;
        const toolTraces: ToolTrace[] = [];
        let iterations = 0;

        // The tool loop (official pattern): 
        // call → if tool_calls, execute → feed result back → call again.
        // Single-tool phase expects exactly 1 iteration
        while (true) {
            const rawResponse = await groqClient.chat.completions.create({
                model: CONFIG.MODEL,
                messages: conversationHistory,
                tools: TOOLS,
                tool_choice: CONFIG.TOOL_CHOICE,
                max_tokens: maxTokens,
                temperature,
                top_p: topP,
            });

            inputTokens += rawResponse.usage?.prompt_tokens ?? 0;
            outputTokens += rawResponse.usage?.completion_tokens ?? 0;

            const assistantMessage = rawResponse.choices[0].message;

            // Branch on finish_reason, never on content (content is null on tool calls)
            if (rawResponse.choices[0].finish_reason !== "tool_calls" || !assistantMessage.tool_calls?.length) {
                conversationHistory.push({ role: "assistant", content: assistantMessage.content ?? "" });
                const lastTool = toolTraces.length > 0 ? toolTraces[toolTraces.length - 1] : null;
                return {
                    messages: conversationHistory,
                    tokenCount: inputTokens + outputTokens, // a tool call costs 2 API calls minimum
                    tool: lastTool,
                    tools: toolTraces,
                    iterations,
                    finishReason: rawResponse.choices[0].finish_reason,
                    totalLatencyMs: Date.now() - startedAt,
                };
            }

            iterations += 1;
            if (iterations > CONFIG.MAX_TOOL_ITERATIONS) {
                const note = `Tool iteration limit (${CONFIG.MAX_TOOL_ITERATIONS}) reached — stopping to avoid an infinite loop.`;
                console.warn(note);
                conversationHistory.push({ role: "assistant", content: note });
                return {
                    messages: conversationHistory,
                    tokenCount: inputTokens + outputTokens,
                    tool: toolTraces.length > 0 ? toolTraces[toolTraces.length - 1] : null,
                    tools: toolTraces,
                    iterations,
                    finishReason: "length",
                    totalLatencyMs: Date.now() - startedAt,
                };
            }

            const toolCall = assistantMessage.tool_calls[0];
            const toolName = toolCall.function.name;
            const toolArgs = toolCall.function.arguments; // always a raw JSON string

            // The decision joins history before its result; tool_call_id must match exactly
            conversationHistory.push(assistantMessage);
            const toolResult = executeTool(toolName, toolArgs);
            conversationHistory.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });

            toolTraces.push({ name: toolName, arguments: toolArgs, result: toolResult });
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