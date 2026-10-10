import router, { Request, Response } from "express";
import chatController from "../controllers/chat.controller";

const chatRouter = router.Router();

chatRouter.post("/generate", chatController.generate);

export default chatRouter;