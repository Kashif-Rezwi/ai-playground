import express from 'express';
import dotenv from 'dotenv';
dotenv.config({ path: "../../.env" });
import healthRouter from './routes/health.route';
import chatRouter from './routes/chat.route';

const app = express();
const port = process.env.PORT || 3001;

// Middleware to parse JSON requests
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/chat', chatRouter);

app.listen(port, () => {
    console.log(`[streaming] Server is running on port ${port}`);
})