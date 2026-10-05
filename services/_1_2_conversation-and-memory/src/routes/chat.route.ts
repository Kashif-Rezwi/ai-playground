import router from "express";
import chatController from "../controllers/chat.controller";
const chatRouter = router();

chatRouter.post("/generate", chatController.generate);
chatRouter.get("/history", chatController.getHistory);

export default chatRouter;