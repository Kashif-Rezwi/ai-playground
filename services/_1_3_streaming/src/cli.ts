import { createInterface } from "readline";
import chatService from "./services/chat.service";
import CONFIG from "./utils/config";
import { Message } from "./utils/types";
import { countTokens } from "./utils/countTokens";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

function printHistory(messages: Message[]): void {
    console.log("");
    console.log(`── Conversation History · ${messages.length} messages · ${countTokens(messages)} tokens ──`);

    if (messages.length === 0) {
        console.log("\n(empty)\n");
        return;
    }

    console.log("");
    messages.forEach((message, index) => {
        const number = String(index + 1).padStart(3);
        const role = message.role.padEnd(9); // "assistant" is the longest role

        console.log(`${number}  ${role}: ${message.content}\n`);
    });
};

async function startCli() {
    console.log("Chat started.");
    console.log("Commands: /history, /clear, /exit");
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

        if (userPrompt === "/history") {
            const history = await chatService.getConversationHistory();
            printHistory(history);
            continue;
        }

        if (userPrompt === "/clear") {
            await chatService.clearHistory();
            console.log("\nConversation history cleared.\n");
            continue;
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