import express from "express";
import chatController from "../controllers/chat.controller";

const chatRouter = express.Router();

// Chat endpoint
chatRouter.post("/generate", chatController.generateText);

export default chatRouter;