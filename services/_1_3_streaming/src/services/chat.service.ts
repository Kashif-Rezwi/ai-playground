import CONFIG from "../utils/config";
import { ChatRequest, Message } from "../utils/types";
import groqClient from "./llm.service";

let conversationHistory: Message[] = [];

const chatService = {
    async *streamText({ systemPrompt, userPrompt, temperature, maxTokens, topP }: ChatRequest): AsyncGenerator<string> {
        // Add system prompt to conversation history if it's the first message
        if (conversationHistory.length === 0) {
            conversationHistory.push({ role: "system", content: systemPrompt });
        }
        conversationHistory.push({ role: "user", content: userPrompt });

        // Initialize an empty string to accumulate the assistant's response
        let assistantMessage = "";

        try {
            const rawResponse = await groqClient.chat.completions.create({
                model: CONFIG.MODEL,
                messages: conversationHistory,
                max_tokens: maxTokens,
                temperature,
                top_p: topP,
                stream: true,
            });

            for await (const chunk of rawResponse) {
                const delta = chunk.choices[0]?.delta?.content ?? "";

                if (delta) {
                    assistantMessage += delta;
                    yield delta;
                }
            }

            // Append the assistant's response to history only after the stream
            conversationHistory.push({
                role: "assistant",
                content: assistantMessage,
            });
        } catch (error) {
            console.error(`Stream failed: ${(error as Error).message}`);

            // Remove the user message if streaming failed.
            conversationHistory.pop();

            throw error;
        }
    },

    async getConversationHistory(): Promise<Message[]> {
        return conversationHistory;
    },

    async clearHistory(): Promise<void> {
        // Reset the in-memory conversation history.
        conversationHistory = [];
    }
}

export default chatService;