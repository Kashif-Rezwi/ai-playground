import dotenv from 'dotenv';
import express from 'express';
import { Groq } from 'groq-sdk';

dotenv.config({ path: '../../.env' });

const app = express();
const port = process.env.PORT || 3001;
const llmApiKey = process.env.LLM_API_KEY;

if (!llmApiKey) {
    console.error('LLM_API_KEY is not set in the environment variables.');
    process.exit(1);
}
const groqClient = new Groq({apiKey: llmApiKey});


app.use(express.json());

app.get('/', (req, res) => {
    res.send({status: 'ok', message: 'Text Generation Service is running!'})
})

app.post('/generate', async (req, res) => {
    try {
        const { systemPrompt, prompt, maxTokens, temperature, topP } = req.body;
        const response = await groqClient.chat.completions.create({
            model: 'openai/gpt-oss-20b',
            messages: [
                {role: 'system', content: systemPrompt},
                { role: 'user',  content: prompt}
            ],
            max_tokens: maxTokens || 500,
            temperature: temperature || 0.7,
            top_p: topP || 1.0
        })

        res.send({ rawResponse: response });
    } catch (error) {
        console.error('Error generating text:', error);
        return res.status(500).send({error: 'Error generating text'});
    }
})


app.listen(port, () => {
    console.log(`[basic-text-generation]: Server is running at http://localhost:${port}`)
})