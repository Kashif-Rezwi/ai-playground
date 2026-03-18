import { Request, Response } from "express";
import { chatService } from "../services/chat.service";
import { GenerateParams } from "@ai-playground/llm-core";

export const chatController = {
    async generate(req: Request, res: Response) {
        try {
            const { systemPrompt, userPrompt, temperature, maxTokens } = req.body;

            if (!userPrompt) {
                return res.status(400).json({ error: "userPrompt is required" });
            }

            const result = await chatService.generateText({
                systemPrompt,
                userPrompt,
                temperature,
                maxTokens,
            } as GenerateParams);

            return res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            console.error("Controller Error:", error);

            return res.status(500).json({
                success: false,
                error: "Failed to generate text",
            });
        }
    },
};