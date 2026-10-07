import { createInterface } from "readline";
import chatService from "./services/chat.service";
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
        console.log("Goodbye!");
    });

    while (running) {
        const userPrompt = await new Promise<string>((resolve) => {
            rl.question("You: ", (input) => resolve(input.trim()));
        }).catch(() => ""); // readline was closed mid-question

        if (!running) break;

        if (userPrompt === "/exit") {
            rl.close();
            break;
        }

        try {
            const chatResponse = await chatService.streamText({
                systemPrompt: CONFIG.SYSTEM_PROMPT,
                userPrompt,
                temperature: CONFIG.TEMPERATURE,
                maxTokens: CONFIG.MAX_TOKENS,
                topP: CONFIG.TOP_P
            });

            // Print and stream the response chunks
            process.stdout.write("\nAssistant: ");
            for await (const chunk of chatResponse) {
                process.stdout.write(chunk);
            }
            console.log("\n");

        } catch (error) {
            console.error("Error occurred while processing user input:", error);
        }
    }
}

startCli();