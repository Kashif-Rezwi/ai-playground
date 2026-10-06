import router from "express";
import chatController from "../controllers/chat.controller";

const chatRouter = router();

chatRouter.post("/stream", chatController.stream);

export default chatRouter;