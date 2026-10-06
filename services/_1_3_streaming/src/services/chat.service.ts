import CONFIG from "../utils/config";
import { ChatRequest } from "../utils/types";
import groqClient from "./llm.service";

const chatService = {
    async generateText({ systemPrompt, userPrompt, temperature, maxTokens, topP }: ChatRequest): Promise<any> { 
        const rawResponse = await groqClient.chat.completions.create({
            model: CONFIG.MODEL,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            max_tokens: maxTokens,
            temperature: temperature,
            top_p: topP
        })

        // Log the raw response for debugging
        console.log("Raw response from LLM:", JSON.stringify(rawResponse, null, 2));

        const assistantMessage = rawResponse.choices[0].message.content as string;
        return assistantMessage;
    }
}

export default chatService;