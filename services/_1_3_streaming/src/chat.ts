import OpenAI from "openai";
import dotenv from "dotenv";
import { Message } from "./types";
import readline from "readline";
import { MAX_RESPONSE_TOKENS, MODEL, STREAM, SYSTEM_PROMPT } from "./config";

dotenv.config({ path: "../../.env" });

const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

let conversationHistory: Message[] = [
    { role: "system", content: SYSTEM_PROMPT }
];

async function chat(userInput: string) {
    // 1. Append new user message
    conversationHistory.push({ role: "user", content: userInput });

    // Calculate Time to First Token (TTFT)
    const startTime = Date.now();
    let isFirstToken = true;

    // 2. Call the API with full history
    const response = await openaiClient.chat.completions.create({
        model: MODEL,
        messages: conversationHistory,
        max_tokens: MAX_RESPONSE_TOKENS,
        temperature: 0.7,
        stream: STREAM
    });

    let fullResponse = "";
    let totalResponseTime = 0;
    let ttftValue = 0;
    let tokenCount = 0;

    if (STREAM) {
        const stream = response as any;

        try {
            // 3. Loop over the stream as chunks arrive
            for await (const chunk of stream) {
                // For experimentation - uncomment to simulate a mid-stream failure
                // if (tokenCount === 5) throw new Error("Simulated mid-stream failure");

                // Calculate TTFT on the very first chunk
                if (isFirstToken) {
                    ttftValue = Date.now() - startTime;

                    // Start the Assistant response line in bold green (\x1b[1m\x1b[32m)
                    process.stdout.write(`\n\x1b[1m\x1b[32mAssistant:\x1b[0m `);

                    isFirstToken = false;
                }

                // Safely extract the chunk delta
                const delta = chunk.choices[0]?.delta?.content || "";

                // Print the token to the screen immediately
                process.stdout.write(delta);

                // Print delta for the current chunk
                // console.log(JSON.stringify(chunk.choices[0]?.delta, null, 2))

                // Uncomment to look at the structure of the chunk
                // console.log(JSON.stringify(chunk, null, 2))

                // Accumulate it in memory
                fullResponse += delta;
                tokenCount++;
            }

            // 4. Append assistant response to history only after stream fully completes
            conversationHistory.push({ role: "assistant", content: fullResponse });

        } catch (err) {
            conversationHistory.pop();
            console.error(`\n\n⚠️  Stream failed: ${(err as Error).message}`);
            console.log(`\x1b[90m Partial response discarded. History restored to last clean state.\x1b[0m`);
            return;
        }
    } else {
        // Buffered response logic
        const completion = response as any;
        fullResponse = completion.choices[0]?.message?.content || "";

        // Start the Assistant response line in bold green (\x1b[1m\x1b[32m)
        process.stdout.write(`\n\x1b[1m\x1b[32mAssistant:\x1b[0m `);
        process.stdout.write(fullResponse);

        // Approximation of token count
        tokenCount = completion.usage?.completion_tokens || fullResponse.split(/\s+/).length;

        // 4. Append assistant response to history
        conversationHistory.push({ role: "assistant", content: fullResponse });
    }

    // 5. Calculate total response/ttft time and tokens per second
    totalResponseTime = (Date.now() - startTime) / 1000;
    const tokensPerSec = (tokenCount / totalResponseTime).toFixed(2);
    let performanceMetrics = `Total Response Time: ${totalResponseTime}sec | Speed: ${tokensPerSec} tokens/sec`;

    if (STREAM) {
        performanceMetrics = `TTFT: ${ttftValue}ms | ${performanceMetrics}`;
    }

    console.log(`\n\n\x1b[90m⚡ ${performanceMetrics}\x1b[0m`);
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

            if (trimmed === "history") {
                console.log("\n📜 [HISTORY]\n", JSON.stringify(conversationHistory, null, 2), "\n");
                return ask();
            }

            if (trimmed === "clear") {
                conversationHistory = [{ role: "system", content: SYSTEM_PROMPT }];
                console.log("🔄 History cleared. Fresh conversation started.\n");
                return ask();
            }

            await chat(trimmed);
            ask();
        })
    }

    ask();

})();