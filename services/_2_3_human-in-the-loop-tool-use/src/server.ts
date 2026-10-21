import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import chatRouter from './routes/chat.route';
import healthRouter from './routes/health.route';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const port = process.env.PORT || 3107;

app.use(express.json());
app.use('/api/health', healthRouter);
app.use('/api/chat', chatRouter);

app.listen(port, () => {
  console.log(`[human-in-the-loop-tool-use] Server is running on port ${port}`);
});
