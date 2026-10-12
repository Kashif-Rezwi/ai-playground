import express, { Request, Response } from "express";

const chatRouter = express.Router();

// Chat endpoint
chatRouter.post("/generate", async (req: Request, res: Response) => {
    // Placeholder for chat generation logic
    res.status(200).json({ message: "Chat generation endpoint is working" });
});

export default chatRouter;