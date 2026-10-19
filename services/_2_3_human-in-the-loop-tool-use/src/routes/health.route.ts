import express, { Request, Response } from 'express';

const healthRouter = express.Router();

healthRouter.get('/', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Human-in-the-loop tool use service is healthy' });
});

export default healthRouter;
