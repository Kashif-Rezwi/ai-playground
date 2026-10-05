import { createInterface } from "readline";
import CONFIG from "./utils/config";
import chatService from "./services/chat.service";
import { hardTruncation } from "./utils/trim-strategy/hardTruncation";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

async function startCli() {
    console.log('Chat started. Type "exit" to quit.\n');

    while (true) {
        const userPrompt = await new Promise<string>((resolve) => {
            rl.question("You: ", (input) => resolve(input.trim()));
        });

        if (userPrompt === "/exit") {
            console.log("Goodbye!");
            rl.close();
            break;
        }

        if (userPrompt === "/history") {
            const history = await chatService.getConversationHistory();
            console.log("\nConversation History:");
            history.forEach((message, index) => {
                console.log(`${index + 1}. ${message.role}: ${message.content}`);
            });
            console.log(""); // Add an extra newline for better readability
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
    