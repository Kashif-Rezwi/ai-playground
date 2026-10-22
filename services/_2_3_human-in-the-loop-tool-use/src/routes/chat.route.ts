import express from 'express';
import chatController from '../controllers/chat.controller.js';

const chatRouter = express.Router();

// Run lifecycle
chatRouter.post('/generate', chatController.generate);
chatRouter.get('/runs/:runId', chatController.getRun);
chatRouter.get('/runs/:runId/stream', chatController.streamRun);  // SSE

// Approval decisions
chatRouter.post('/approvals/:approvalId/approve', chatController.approve);
chatRouter.post('/approvals/:approvalId/reject', chatController.reject);

export default chatRouter;
