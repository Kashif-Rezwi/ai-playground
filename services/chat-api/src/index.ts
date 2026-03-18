import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import OpenAI from 'openai';

dotenv.config({ path: '../../.env' });

const app = express();
const openai = new OpenAI();
const port = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
    res.json({ message: 'Hello World!' });
});

app.post('/generate', async (req: Request, res: Response) => {
    const { systemPrompt, userPrompt, temperature, maxTokens } = req.body;

    if (!userPrompt) {
        return res.status(400).json({ error: 'userPrompt is required' });
    }

    const messages = [
        ...(systemPrompt
            ? [{ role: "system" as const, content: systemPrompt }]
            : []),
        { role: "user" as const, content: userPrompt }
    ];

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messages,
            temperature: temperature ?? 0.7,
            max_tokens: maxTokens ?? 500,
        })

        res.json({
            rawResponse: response,
        })
    } catch (error) {
        console.error('Error generating text:', error);
        return res.status(500).json({ error: 'Failed to generate text' });
    }

});

app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});