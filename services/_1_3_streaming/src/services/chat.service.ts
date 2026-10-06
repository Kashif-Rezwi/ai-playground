import CONFIG from "../utils/config";
import { ChatRequest, ChatResponse, Message } from "../utils/types";
import groqClient from "./llm.service";

const conversationHistory: Message[] = [];

const chatService = {
    async generateText({ systemPrompt, userPrompt, temperature, maxTokens, topP }: ChatRequest): Promise<ChatResponse> {
        // Add system prompt to conversation history if it's the first message
        if (conversationHistory.length === 0) {
            conversationHistory.push({ role: "system", content: systemPrompt });
        };
        conversationHistory.push({ role: "user", content: userPrompt });

        const rawResponse = await groqClient.chat.completions.create({
            model: CONFIG.MODEL,
            messages: conversationHistory,
            max_tokens: maxTokens,
            temperature: temperature,
            top_p: topP
        })

        // Log the raw response for debugging
        // console.log("Raw response from LLM:", JSON.stringify(rawResponse, null, 2));

        // Add assistant's response to conversation history
        const assistantMessage = rawResponse.choices[0].message.content as string;
        conversationHistory.push({ role: "assistant", content: assistantMessage });

        return {
            messages: conversationHistory,
            tokenCount: rawResponse.usage?.total_tokens || 0,
        };
    }
}

export default chatService;