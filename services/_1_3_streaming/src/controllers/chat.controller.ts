import { Request, Response } from "express";
import CONFIG from "../utils/config";
import { ChatRequest } from "../utils/types";
import chatService from "../services/chat.service";

const chatController = {
    async stream(req: Request, res: Response): Promise<void> {
        const { 
            systemPrompt = CONFIG.SYSTEM_PROMPT, 
            userPrompt = "", 
            temperature = CONFIG.TEMPERATURE, 
            maxTokens = CONFIG.MAX_TOKENS, 
            topP = CONFIG.TOP_P 
        }: ChatRequest = req.body;

        // Validate required fields
        if (!userPrompt) {
            res.status(400).json({ error: "User prompt is required" });
            return;
        }

        // Set headers for streaming response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
            // Call the chat service to stream the response
            const streamGenerator = chatService.streamText({ systemPrompt, userPrompt, temperature, maxTokens, topP });
            for await (const chunk of streamGenerator) {
                res.write(`data: ${chunk})\n\n`);
            }
            res.write('data: [DONE]\n\n');
            res.end();
        } catch (error) {
            console.error("Error streaming chat response:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
}

export default chatController;