import router from "express";
import chatController from "../controllers/chat.controller";

const chatRouter = router();

chatRouter.post("/generate", chatController.generate);
chatRouter.post("/stream", chatController.stream);

export default chatRouter;