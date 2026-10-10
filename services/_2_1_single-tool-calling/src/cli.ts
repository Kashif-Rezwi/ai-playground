import { createInterface } from "readline";
import chatService from "./services/chat.service";
import { SYSTEM_PROMPT } from "./utils/prompts";
import CONFIG from "./utils/config";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

async function startCli() {
    console.log("Chat started.");
    console.log("Commands: /exit");
    console.log("");

    let running = true;

    // Gracefully stop the CLI on Ctrl+C
    rl.on("close", () => {
        running = false;
        console.log("\nGoodbye!\n");
    });

    while (running) {
        const userPrompt = await new Promise<string>((resolve) => {
            rl.question("You: ", (input) => resolve(input.trim()));
        }).catch(() => ""); // readline was closed mid-question

        if (!running) break;

        if (userPrompt === "/exit") {
            rl.close();
            break;
        };

        try {
            const chatResponse = await chatService.generateText({
                systemPrompt: SYSTEM_PROMPT,
                userPrompt,
                temperature: CONFIG.TEMPERATURE,
                maxTokens: CONFIG.MAX_TOKENS,
                topP: CONFIG.TOP_P
            });

            const assistantMessage = chatResponse.messages[chatResponse.messages.length - 1].content;
            console.log(`\nAssistant: ${assistantMessage}`);
            console.log(`\n[TOKENS] ${chatResponse.tokenCount} tokens · ${chatResponse.messages.length} messages in history\n`);
        } catch (error) {
            console.error("Error generating chat response:", error);
        }
    }
};

startCli();