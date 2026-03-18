import { generateText, GenerateParams } from "@ai-playground/llm-core";

export const chatService = {
    async generateText(input: GenerateParams) {
        if (!input.userPrompt) {
            throw new Error("userPrompt is required");
        }

        const result = await generateText(input);

        return result;
    },
};