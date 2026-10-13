import express from "express";
import chatController from "../controllers/chat.controller";

const chatRouter = express.Router();

chatRouter.post("/generate", chatController.generate);
chatRouter.get("/history", chatController.getHistory);
chatRouter.delete("/history", chatController.clearHistory);

export default chatRouter;