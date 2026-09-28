import { Request, Response } from "express";
import chatService from "../services/chat.service";
import CONFIG from "../config";
import { GenerateChatRequest, Message } from "../types";

const chatController = {
    async generate(req: Request, res: Response): Promise<Response> {
        const {
            systemPrompt=CONFIG.SYSTEM_PROMPT, 
            userPrompt="", 
            temperature=CONFIG.TEMPERATURE, 
            maxTokens=CONFIG.MAX_TOKENS, 
            topP=CONFIG.TOP_P 
        }: GenerateChatRequest = req.body;

        try {
            // Validate input
            if (!userPrompt) {
                return res.status(400).json({ error: "User prompt is required" });
            };

            // Call the service to generate text
            const generatedText = await chatService.generateText({ systemPrompt, userPrompt, temperature, maxTokens, topP });

            // Return the generated text
            return res.status(200).json({ generatedText });
        } catch (error) {
            console.error("Error generating chat response:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
}

export default chatController;