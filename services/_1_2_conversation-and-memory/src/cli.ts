import { createInterface } from "readline";
import CONFIG from "./utils/config";
import chatService from "./services/chat.service";
import { countTokens } from "./utils/countTokens";
import { Message } from "./utils/types";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

function printHistory(messages: Message[]): void {
    console.log("");
    console.log(`── Conversation History · ${messages.length} messages · ${countTokens(messages)} tokens ──`);

    if (messages.length === 0) {
        console.log("(empty)");
        console.log("");
        return;
    }

    console.log("");
    messages.forEach((message, index) => {
        const number = String(index + 1).padStart(3);
        const role = message.role.padEnd(9); // "assistant" is the longest role

        for (const line of message.content.split("\n")) {
            console.log(`${number}  ${role}: ${line}\n`);
        }
    });
}

async function startCli() {
    console.log("Chat started.");
    console.log("Commands: /history, /exit");
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

        if (userPrompt === "/history") {
            printHistory(await chatService.getConversationHistory());
            continue;
        }

        if (!userPrompt) continue;

        try {
            const chatResponse = await chatService.generateText({
                systemPrompt: CONFIG.SYSTEM_PROMPT,
                userPrompt,
                temperature: CONFIG.TEMPERATURE,
                maxTokens: CONFIG.MAX_TOKENS,
                topP: CONFIG.TOP_P
            });

            const assistantMessage = chatResponse.messages[chatResponse.messages.length - 1].content;

            console.log(`\nAssistant: ${assistantMessage}\n`);
        } catch (error) {
            console.error("Error generating chat response:", error);
        }
    }
};

startCli();
