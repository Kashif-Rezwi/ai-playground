import { Request, Response } from "express";
import chatService from "../services/chat.service";

const chatController = {
    async generate(req: Request, res: Response): Promise<Response> {
        const { systemPrompt, userPrompt, temperature, maxTokens, topP } = req.body;
        try {
            // Validate userPrompt input
            if (!userPrompt) {
                return res.status(400).json({ error: "User prompt is required" });
            };

            // Call the service to generate text
            const generatedText = await chatService.generateText({ systemPrompt, userPrompt, temperature, maxTokens, topP });

            // Return the generated text
            return res.status(200).json({ generatedText });
        } catch (error) {
            throw new Error(`Error generating chat response: ${error}`);
        }
    }
}

export default chatController;