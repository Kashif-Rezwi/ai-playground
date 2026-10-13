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
            conversationHistory.push({ role: "system", content: systemPrompt ?? "" });
        }

        // Append the user prompt to the conversation history
        conversationHistory.push({ role: "user", content: userPrompt });

        // Initialize counters and traces
        let inputTokens = 0;
        let outputTokens = 0;
        const toolTraces: ToolTrace[] = [];

        // If tool_calls, execute ALL of them → feed results back → call again.
        // Parallel tool calls arrive as one assistant message with multiple tool_calls entries.
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
                
                // Return the last tool trace if any, otherwise null
                const lastTool = toolTraces.length > 0 ? toolTraces[toolTraces.length - 1] : null;
                return {
                    messages: conversationHistory,
                    tokenCount: inputTokens + outputTokens, // a tool turn costs 2+ API calls
                    tool: lastTool,
                    tools: toolTraces,
                    finishReason: rawResponse.choices[0].finish_reason,
                    totalLatencyMs: Date.now() - startedAt,
                };
            }

            // Append the assistant message to history, even if it has no content (tool calls only)
            conversationHistory.push(assistantMessage);

            // Iterate over EVERY tool call — parallel or sequential.
            for (const toolCall of assistantMessage.tool_calls) {
                if (toolCall.type !== "function") continue;

                const toolName = toolCall.function.name;
                const toolArgs = toolCall.function.arguments;

                console.log(`[TOOL] Executing: ${toolName}(${toolArgs})`);

                let toolResult: string;
                try {
                    toolResult = executeTool(toolName, toolArgs);
                } catch {
                    // If the tool execution throws an unexpected error, we catch it and return a generic error message.
                    toolResult = JSON.stringify({ error: "Tool execution failed unexpectedly." });
                }
         
                console.log(`[TOOL] Result: ${toolResult}`);

                conversationHistory.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });

                toolTraces.push({ name: toolName, arguments: toolArgs, result: toolResult });
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