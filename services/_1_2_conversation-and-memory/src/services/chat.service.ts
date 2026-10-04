import { countTokens } from "../utils/countTokens";
import { GenerateChatRequest, GenerateChatResponse, Message } from "../utils/types";
import groqClient from "./llm.service";

let conversationHistory: Message[] = [];

const chatService = {
    async generateText({ systemPrompt, userPrompt, temperature, maxTokens, topP }: GenerateChatRequest): Promise<GenerateChatResponse> {
        // Initialize conversation history if empty
        if (conversationHistory.length === 0) {
            conversationHistory.push({ role: "system", content: systemPrompt });
        }

        // Append the user prompt to the conversation history
        conversationHistory.push({ role: "user", content: userPrompt });
        
        // Call the LLM API
        const rawResponse  = await groqClient.chat.completions.create({
            model: 'openai/gpt-oss-20b',
            messages: conversationHistory,
            max_tokens: maxTokens,
            temperature: temperature,
            top_p: topP
        });

        // Log the raw response for debugging
        console.log("Raw response from LLM:", JSON.stringify(rawResponse, null, 2));

        // Extract the assistant's message and append it to the conversation history
        const assistantMessage = rawResponse.choices[0].message.content as string;
        conversationHistory.push({ role: "assistant", content: assistantMessage });

        // Calculate the total token count for the conversation history
        const totalTokenCount = countTokens(conversationHistory);

        return { 
            messages: conversationHistory,
            tokenCount: totalTokenCount
        };
    }
}

export default chatService; 