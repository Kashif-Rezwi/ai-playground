import { Router } from "express";
import { chatController } from "../controllers/chat.controller";


const router = Router();

router.post('/generate', chatController.generate);

export default router;