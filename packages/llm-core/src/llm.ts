import OpenAI from "openai";
import { GenerateParams } from "./types";

export async function generateText(params: GenerateParams) {
    const { apiKey, systemPrompt, userPrompt, temperature, maxTokens } = params;

    const openaiClient = new OpenAI({
        apiKey: apiKey
    });

    const messages = [];

    if (systemPrompt) {
        messages.push({
            role: "system" as const,
            content: systemPrompt,
        });
    }

    messages.push({
        role: "user" as const,
        content: userPrompt,
    });

    const response = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 500,
    });

    return response.choices[0].message.content;
}
