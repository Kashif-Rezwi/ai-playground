import express, { Request, Response } from 'express';
import chatController from '../controllers/chat.controller';

const chatRouter = express.Router();

chatRouter.post('/generate', chatController.generate);

export default chatRouter;