import express from 'express';
import chatRouter from './routes/chat.route.js';
import healthRouter from './routes/health.route.js';

const app = express();
const port = process.env.PORT || 3107;

app.use(express.json());
app.use('/api/health', healthRouter);
app.use('/api/chat', chatRouter);

app.listen(port, () => {
  console.log(`[human-in-the-loop-tool-use] Server running on port ${port}`);
});
