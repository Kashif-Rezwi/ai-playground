import express, { Request, Response } from "express";

const healthRouter = express.Router();

healthRouter.get("/", (req: Request, res: Response) => {
    res.status(200).json({ status: "ok", message: "Single tool calling server is healthy" });
});

export default healthRouter;