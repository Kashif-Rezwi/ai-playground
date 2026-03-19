import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import { Message } from "./types";

dotenv.config({ path: "../../.env" });

const app = express();
const port = process.env.PORT || 3001;
const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());

// app.use("/", (req, res) => {
//     res.send("Hello World!");
// })

app.post("/generate-text", async (req, res) => {
    const { systemPrompt, userPrompt, temperature, maxTokens } = req.body;

    if (!userPrompt) {
        return res.status(400).json({ error: "User prompt is required" });
    }

    const messages: Message[] = [];

    if (systemPrompt) {
        messages.push({
            role: "system",
            content: systemPrompt
        })
    }

    messages.push({
        role: "user",
        content: userPrompt
    })

    try {
        const response = await openaiClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            temperature: temperature ?? 0.7,
            max_tokens: maxTokens ?? 500,
        })

        res.json({
            rawResponse: response
        })
    } catch (error) {
        console.error("Error generating text:", error);
        return res.status(500).json({ error: "Failed to generate text" });
    }
})

app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
})