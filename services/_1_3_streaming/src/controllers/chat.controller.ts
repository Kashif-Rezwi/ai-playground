import { Request, Response } from "express";
import CONFIG from "../utils/config";
import { ChatRequest } from "../utils/types";
import chatService from "../services/chat.service";

const chatController = {
    async generate(req: Request, res: Response): Promise<Response> {
        const { 
            systemPrompt = CONFIG.SYSTEM_PROMPT, 
            userPrompt = "", 
            temperature = CONFIG.TEMPERATURE, 
            maxTokens = CONFIG.MAX_TOKENS, 
            topP = CONFIG.TOP_P 
        }: ChatRequest = req.body;

        try {
            // Validate required fields
            if (!userPrompt) {
                return res.status(400).json({ error: "User prompt is required" });
            }
    
            // Call the chat service to generate a response
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