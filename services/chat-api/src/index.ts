import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import chatRoutes from './routes/chat.route';

dotenv.config({ path: '../../.env' });

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
    res.json({ message: 'Hello World!' });
});

app.use('/chat', chatRoutes);

app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});