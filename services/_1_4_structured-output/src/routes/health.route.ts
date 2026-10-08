import express, {Request, Response} from "express";

const healthRouter = express.Router();

// Health check endpoint
healthRouter.get("/", (req: Request, res: Response) => {
    res.status(200).json({ status: "ok", message: "Structured Output Service is healthy" });
})

export default healthRouter;