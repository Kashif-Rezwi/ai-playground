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
        let toolTrace: ToolTrace | null = null;

        // The tool loop (official pattern): call → if tool_calls, execute → feed result back → call again
        while (true) {
            const rawResponse = await groqClient.chat.completions.create({
                model: CONFIG.MODEL,
                messages: conversationHistory,
                tools: TOOLS, // tool_choice defaults to "auto" (the model decides)
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
                return {
                    messages: conversationHistory,
                    tokenCount: inputTokens + outputTokens, // a tool call costs 2 API calls minimum
                    tool: toolTrace,
                    finishReason: rawResponse.choices[0].finish_reason,
                    totalLatencyMs: Date.now() - startedAt,
                };
            }

            const toolCall = assistantMessage.tool_calls[0];
            const toolName = toolCall.function.name;
            const toolArgs = toolCall.function.arguments; // always a raw JSON string

            // The decision joins history before its result; tool_call_id must match exactly
            conversationHistory.push(assistantMessage);
            const toolResult = executeTool(toolName, toolArgs);
            console.log(`[TOOL] ${toolName}(${toolArgs}) → ${toolResult}`);
            conversationHistory.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });

            toolTrace = { name: toolName, arguments: toolArgs, result: toolResult };
        }
    },
};

export default chatService;