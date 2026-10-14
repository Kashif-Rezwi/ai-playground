import express, { Request, Response } from "express";

const healthRouter = express.Router();

// Health check endpoint
healthRouter.get("/", (req: Request, res: Response) => {
    res.status(200).json({ status: "ok", message: "Multi-tool calling service is healthy" });
})

export default healthRouter;