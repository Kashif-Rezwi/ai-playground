import { Request, Response } from "express";
import chatService from "../services/chat.service";
import CONFIG from "../utils/config";
import { SYSTEM_PROMPT } from "../utils/prompts";
import { GenerateChatRequest } from "../utils/types";

const chatController = {
    async generate(req: Request, res: Response): Promise<Response> {
        const {
            systemPrompt = SYSTEM_PROMPT,
            userPrompt = "",
            temperature = CONFIG.TEMPERATURE,
            maxTokens = CONFIG.MAX_TOKENS,
            topP = CONFIG.TOP_P
        }: GenerateChatRequest = req.body;

        try {
            // Validate userPrompt
            if (!userPrompt) {
                return res.status(400).json({ error: "User prompt is required" });
            };

            // Call the service to generate text
            const chatResponse = await chatService.generateText({ systemPrompt, userPrompt, temperature, maxTokens, topP });

            // Return the generated text
            return res.status(200).json(chatResponse);
        } catch (error) {
            console.error("Error generating chat response:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
}

export default chatController;