import CONFIG from '../utils/config';
import { GenerateChatRequest, GenerateChatResponse, Message } from '../utils/types';
import { TOOLS } from '../tools/registry';
import { executeToolBatch } from '../utils/tool-loop';
import groqClient from './llm.service';

let conversationHistory: Message[] = [];

const chatService = {
    async generateText(_request: GenerateChatRequest): Promise<GenerateChatResponse> {
        const { systemPrompt, userPrompt, temperature, maxTokens, topP } = _request;

        if (conversationHistory.length === 0) {
            conversationHistory.push({ role: 'system', content: systemPrompt || '' });
        }

        conversationHistory.push({ role: 'user', content: userPrompt });

        let iterations = 0;
        let totalTokenCount = 0;

        while (true) {
            const rawResponse = await groqClient.chat.completions.create({
                model: CONFIG.MODEL,
                messages: conversationHistory,
                tools: TOOLS,
                tool_choice: CONFIG.TOOL_CHOICE,
                max_tokens: maxTokens,
                temperature: temperature,
                top_p: topP,
            });

            totalTokenCount += rawResponse?.usage?.total_tokens || 0;

            const assistantMessage = rawResponse.choices[0].message;

            // Branch on finish_reason, never on content (content is null on tool calls)
            if (rawResponse.choices[0].finish_reason !== 'tool_calls' || !assistantMessage.tool_calls?.length) {
                conversationHistory.push({ role: 'assistant', content: assistantMessage.content ?? '' });
                return { messages: [...conversationHistory], tokenCount: totalTokenCount };
            }

            iterations += 1;

            // Keep tool_calls on the assistant message so the tool results below bind to it
            conversationHistory.push(assistantMessage);

            // Parallel calls arrive in one message — execute all of them
            executeToolBatch(assistantMessage.tool_calls, (message) => {
                conversationHistory.push(message);
                if (message.role === 'tool') {
                    console.log(`[TOOL] ${message.tool_call_id} -> ${message.content}`);
                }
            });

            if (iterations >= CONFIG.MAX_TOOL_ITERATIONS) {
                const note = `Tool iteration limit (${CONFIG.MAX_TOOL_ITERATIONS}) reached - stopping to avoid an infinite loop.`;
                console.warn(note);
                conversationHistory.push({ role: 'assistant', content: note });
                return { messages: [...conversationHistory], tokenCount: totalTokenCount };
            }
        }
    },

    async getConversationHistory(): Promise<Message[]> {
        return [...conversationHistory];
    },

    async clearHistory(): Promise<void> {
        conversationHistory = [];
    },
};

export default chatService;
