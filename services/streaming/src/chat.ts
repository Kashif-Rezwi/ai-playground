import OpenAI from "openai";
import dotenv from "dotenv";
import { Message } from "./types";
import readline from "readline";

dotenv.config({ path: "../../.env" });

const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const conversationHistory: Message[] = [
    { role: "system", content: "You are a helpful assistant." }
];

async function chat(userInput: string) {
    // 1. Append new user message
    conversationHistory.push({ role: "user", content: userInput });

    // Calculate Time to First Token (TTFT)
    const startTime = Date.now();
    let isFirstToken = true;

    // 2. Call the API with full history
    const stream = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: conversationHistory,
        max_tokens: 500,
        temperature: 0.7,
        stream: true
    });

    let fullResponse = "";
    let ttftValue = 0;

    // 3. Loop over the stream as chunks arrive
    for await (const chunk of stream) {
        // Calculate TTFT on the very first chunk
        if (isFirstToken) {
            ttftValue = Date.now() - startTime;

            // Add a final newline and the metric in dim gray
            console.log(`\n⚡ TTFT: ${ttftValue}ms\n`);

            // Start the Assistant response line in bold green (\x1b[1m\x1b[32m)
            process.stdout.write(`\x1b[1m\x1b[32mAssistant:\x1b[0m `);

            isFirstToken = false;
        }

        // Safely extract the chunk delta
        const delta = chunk.choices[0]?.delta?.content || "";

        // Print the token to the screen immediately
        process.stdout.write(delta);

        // Accumulate it in memory
        fullResponse += delta;
    }

    // 4. Add a final newline when the stream completely finishes
    console.log("\n");

    // 5. Append assistant response to history
    conversationHistory.push({ role: "assistant", content: fullResponse });

}

(async function () {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })

    console.log("\n🤖 Chat started. Type 'exit' to quit.\n");

    const ask = () => {
        rl.question("\n\x1b[1m\x1b[36mYou:\x1b[0m ", async (input) => {
            const trimmed = input.trim();

            if (trimmed.toLowerCase() === "exit") {
                console.log(`\n\x1b[1m\x1b[32mAssistant:\x1b[0m Goodbye!\n`);
                rl.close();
                return;
            }

            await chat(trimmed);
            ask();
        })
    }

    ask();

})();