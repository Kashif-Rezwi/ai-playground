import CONFIG from '../utils/config';
import { GenerateChatRequest, GenerateChatResponse, Message } from '../utils/types';
import groqClient from './llm.service';

let conversationHistory: Message[] = [];

const chatService = {
    async generateText(_request: GenerateChatRequest): Promise<GenerateChatResponse> {
        const { systemPrompt, userPrompt, temperature, maxTokens, topP } = _request;

        if (conversationHistory.length === 0) {
            conversationHistory.push({ role: 'system', content: systemPrompt || '' });
        }

        conversationHistory.push({ role: 'user', content: userPrompt });

        const RawResponse = await groqClient.chat.completions.create({
            model: CONFIG.MODEL,
            messages: conversationHistory,
            max_tokens: maxTokens,
            temperature: temperature,
            top_p: topP
        })

        const assistantMessage = RawResponse.choices[0].message.content as string;
        conversationHistory.push({ role: 'assistant', content: assistantMessage });

        const totalTokenCount = RawResponse?.usage?.total_tokens || 0;

        return {
            messages: [...conversationHistory],
            tokenCount: totalTokenCount,
        };
    },

    async getConversationHistory(): Promise<Message[]> {
        return [...conversationHistory];
    },

    async clearHistory(): Promise<void> {
        conversationHistory = [];
    },
};

export default chatService;
