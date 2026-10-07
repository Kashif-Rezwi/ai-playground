import router from "express";
import chatController from "../controllers/chat.controller";

const chatRouter = router();

chatRouter.post("/stream", chatController.stream);
chatRouter.get("/history", chatController.getHistory);
chatRouter.delete("/history", chatController.clearHistory);

export default chatRouter;