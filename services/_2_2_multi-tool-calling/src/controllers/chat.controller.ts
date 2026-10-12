import { Request, Response } from "express";
import CONFIG from "../utils/config";
import { SYSTEM_PROMPT } from "../utils/prompts";
import { GenerateChatRequest } from "../utils/types";

const chatController = {
    generateText: async (req: Request, res: Response): Promise<Response> => {
        try {
            return res.status(200).json({ message: "Text generated successfully" });
        } catch (error) {
            console.error("Error generating chat response:", error);
            return res.status(500).json({ error: "Internal server error" });
        }

    }
}

export default chatController;