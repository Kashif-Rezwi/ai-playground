import CONFIG from "../utils/config";
import { GenerateChatRequest, GenerateChatResponse, Message } from "../utils/types";
import groqClient from "./llm.service";

const conversationHistory: Message[] = [];

const chatService = {
    async generateText({ systemPrompt, userPrompt, temperature, maxTokens, topP }: GenerateChatRequest): Promise<GenerateChatResponse> {
        // Initialize conversation history if empty, then append the user prompt
        if (conversationHistory.length === 0) {
            conversationHistory.push({ role: "system", content: systemPrompt });
        }

        // Append the user prompt to the conversation history
        conversationHistory.push({ role: "user", content: userPrompt });

        // Call the LLM API
        const rawResponse = await groqClient.chat.completions.create({
            model: CONFIG.MODEL,
            messages: conversationHistory,
            max_tokens: maxTokens,
            temperature,
            top_p: topP
        })

        // Extract the assistant's message and append it to the conversation history
        const assistantMessage = rawResponse.choices[0].message.content as string;
        conversationHistory.push({ role: "assistant", content: assistantMessage });

        // Calculate the total token count for the conversation history
        const totalTokenCount = rawResponse.usage?.total_tokens ?? 0;

        return {
            messages: conversationHistory,
            tokenCount: totalTokenCount
        };
    }
};

export default chatService;