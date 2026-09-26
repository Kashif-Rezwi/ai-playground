import { GenerateChatRequest } from "../types";
import groqClient from "./llm.service";

const chatService = {
    async generateText({ systemPrompt, userPrompt, temperature, maxTokens, topP }: GenerateChatRequest): Promise<String> {
        // business logic to generate text.
        const response  = await groqClient.chat.completions.create({
            model: 'openai/gpt-oss-20b',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: maxTokens || 500,
            temperature: temperature || 0.7,
            top_p: topP || 1.0
        });

        console.log("Raw response from LLM:", response);
        return response.choices[0].message.content as string;;
    }
}

export default chatService; 