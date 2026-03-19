import OpenAI from "openai";
import { Message } from "./types";
import readline from "readline";
import dotenv from "dotenv";
import { trimHistory } from "./trimHistory";
import { countTokens } from "./countTokens";
import { MODEL, SYSTEM_PROMPT, MAX_RESPONSE_TOKENS } from "./config";

dotenv.config({ path: "../../.env" });

const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export let conversationHistory: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
];

export async function chat(userInput: string): Promise<void> {
    // 1. Append new user message
    conversationHistory.push({ role: "user", content: userInput });

    // 2. Trim if over budget
    conversationHistory = trimHistory(conversationHistory);

    // 3. Log token count BEFORE sending
    const tokenCount = countTokens(conversationHistory);
    console.log(`📊 [TOKENS] Sending ${tokenCount} tokens in this turn.`);

    // 4. Call the API with full history
    const response = await openaiClient.chat.completions.create({
        model: MODEL,
        messages: conversationHistory,
        max_tokens: MAX_RESPONSE_TOKENS,
        temperature: 0.7,
    });

    const assistantMessage = response.choices[0].message.content ?? "";

    // 5. Append assistant response to history
    conversationHistory.push({ role: "assistant", content: assistantMessage });

    // 6. Print the response
    console.log(`\nAssistant: ${assistantMessage}\n`);
};

// IIFE (Immediately Invoked Function Expression)
(async function () {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    console.log('🤖 Chat started. Type "history", "clear", or "exit".\n');

    const ask = () => {
        rl.question("You: ", async (input) => {
            const trimmed = input.trim();

            if (trimmed === "exit") {
                console.log("Goodbye!");
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

            if (!trimmed) return ask();

            await chat(trimmed);
            ask(); // loop back
        });
    };

    ask();
})();