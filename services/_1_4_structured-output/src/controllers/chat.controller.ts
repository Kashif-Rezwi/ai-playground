import { Request, Response } from "express"; // ← the missing import that caused TS2304
import chatService from "../services/chat.service";
import { ReviewMode, ReviewRequest } from "../utils/types";

const VALID_MODES: ReviewMode[] = ["prompt", "json", "schema"];

const chatController = {
    async generate(req: Request, res: Response): Promise<Response> {
        const { code, mode = "prompt" }: ReviewRequest = req.body;

        // Validate required fields
        if (!code || typeof code !== "string") {
            return res.status(400).json({ error: "'code' is required and must be a non-empty string" });
        }
        if (mode && !VALID_MODES.includes(mode)) {
            return res.status(400).json({ error: `'mode' must be one of: ${VALID_MODES.join(", ")}` });
        }

        try {
            const { review, stats } = await chatService.generateStructuredOutput({ code, mode });
            return res.status(200).json({ message: "Code review generated successfully", data: review, stats });
        } catch (error) {
            console.error("Error generating structured review:", error);
            const message = error instanceof Error ? error.message : "Internal server error";
            // Validation failures (invalid JSON, wrong shape, or retries exhausted) → 422; anything else (API, network, config) → 500
            const status = message.includes("validation") ? 422 : 500;
            return res.status(status).json({ error: message });
        }
    },
};

export default chatController;
