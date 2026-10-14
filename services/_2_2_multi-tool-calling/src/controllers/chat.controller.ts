import { Request, Response } from "express";
import { z } from "zod";
import CONFIG from "../utils/config";
import { SYSTEM_PROMPT } from "../utils/prompts";
import chatService from "../services/chat.service";

const generateChatRequestSchema = z.object({
    systemPrompt: z.string().optional(),
    userPrompt: z.string().trim().min(1, "User prompt is required"),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    topP: z.number().min(0).max(1).optional(),
});

const chatController = {
    async generate(req: Request, res: Response): Promise<Response> {
        const parsedRequest = generateChatRequestSchema.safeParse(req.body);

        if (!parsedRequest.success) {
            return res.status(400).json({
                error: "Invalid chat request",
                details: parsedRequest.error.issues.map((issue) => ({
                    path: issue.path.join("."),
                    message: issue.message,
                })),
            });
        }

        const {
            systemPrompt = SYSTEM_PROMPT,
            userPrompt,
            temperature = CONFIG.TEMPERATURE,
            maxTokens = CONFIG.MAX_TOKENS,
            topP = CONFIG.TOP_P,
        } = parsedRequest.data;

        try {
            // Call the service to generate text
            const chatResponse = await chatService.generateText({ systemPrompt, userPrompt, temperature, maxTokens, topP });

            // Return the generated text
            return res.status(200).json(chatResponse);
        } catch (error) {
            console.error("Error generating chat response:", error);

            // Determine the appropriate error message and status code
            const message = error instanceof Error ? error.message : "Internal server error";

            // Tool-call generation exhausted its retries → 422; anything else (API, network, config) → 500
            const status = message.includes("Failed to generate valid tool calls") ? 422 : 500;

            return res.status(status).json({ error: message });
        }
    },

    async getHistory(req: Request, res: Response): Promise<Response> {
        try {
            // Return the conversation history
            return res.status(200).json({ messages: await chatService.getConversationHistory() });
        } catch (error) {
            console.error("Error retrieving conversation history:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    },

    async clearHistory(req: Request, res: Response): Promise<Response> {
        try {
            // Reset the conversation history
            await chatService.clearHistory();
            return res.status(200).json({ message: "Conversation history cleared", messages: [] });
        } catch (error) {
            console.error("Error clearing conversation history:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
}

export default chatController;