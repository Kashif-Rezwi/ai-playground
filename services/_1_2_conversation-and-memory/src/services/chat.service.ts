import groqClient from "./llm.service";
import { GenerateChatRequest, GenerateChatResponse, Message } from "../utils/types";
import { countTokens } from "../utils/countTokens";
import { prepareContext } from "../utils/context-manager";
import CONFIG from "../utils/config";

let conversationHistory: Message[] = [];

const chatService = {
    async generateText({ systemPrompt, userPrompt, temperature, maxTokens, topP }: GenerateChatRequest): Promise<GenerateChatResponse> {
        // Initialize conversation history if empty
        if (conversationHistory.length === 0) {
            conversationHistory.push({ role: "system", content: systemPrompt });
        }

        // Append the user prompt to the conversation history
        conversationHistory.push({ role: "user", content: userPrompt });

        // Prepare the context by applying necessary trimming or summarization
        const messagesForRequest = await prepareContext(conversationHistory);
        
        // Call the LLM API
        const rawResponse  = await groqClient.chat.completions.create({
            model: CONFIG.MODEL,
            messages: messagesForRequest,
            max_tokens: maxTokens,
            temperature: temperature,
            top_p: topP
        });

        // Log the raw response for debugging
        // console.log("Raw response from LLM:", JSON.stringify(rawResponse, null, 2));

        // Extract the assistant's message and append it to the conversation history
        const assistantMessage = rawResponse.choices[0].message.content as string;
        conversationHistory = [
            ...messagesForRequest, 
            { role: "assistant", content: assistantMessage }
        ];

        // Calculate the total token count for the conversation history
        const totalTokenCount = countTokens(conversationHistory);

        return { 
            messages: conversationHistory,
            tokenCount: totalTokenCount
        };
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