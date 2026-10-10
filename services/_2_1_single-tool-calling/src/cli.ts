import { createInterface } from "readline";
import chatService from "./services/chat.service";
import { SYSTEM_PROMPT } from "./utils/prompts";
import CONFIG from "./utils/config";
import { countTokens } from "./utils/countTokens";
import { Message } from "./utils/types";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

function messagePreview(message: Message): string {
    const role = message.role;
    if (role === "assistant") {
        const msg = message as { content?: string | null; tool_calls?: Array<{ function: { name: string; arguments: string } }> };
        if (msg.tool_calls?.length) {
            const calls = msg.tool_calls.map((c) => `${c.function.name}(${c.function.arguments})`).join(", ");
            return `(tool call) ${calls}`;
        }
        return String(msg.content ?? "(null)");
    }
    if (role === "tool") {
        return String((message as { content?: unknown }).content ?? "");
    }
    return String((message as { content?: unknown }).content ?? "");
}

function printHistory(messages: Message[]): void {
    console.log("");
    console.log(`── Conversation History · ${messages.length} messages · ~${countTokens(messages)} tokens (est.) ──`);

    if (messages.length === 0) {
        console.log("(empty)");
        console.log("");
        return;
    }

    console.log("");
    messages.forEach((message, index) => {
        const number = String(index + 1).padStart(3);
        const role = message.role.padEnd(9); // "assistant" is the longest role

        console.log(`${number}  ${role}: ${messagePreview(message)}\n`);
    });
}

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
            printHistory(await chatService.getConversationHistory());
            continue;
        }

        if (userPrompt === "/clear") {
            await chatService.clearHistory();
            console.clear();
            console.log("Conversation history cleared. Starting fresh.");
            console.log("Commands: /history, /clear, /exit");
            console.log("");
            continue;
        }

        if (!userPrompt) continue;

        try {
            const chatResponse = await chatService.generateText({
                systemPrompt: SYSTEM_PROMPT,
                userPrompt,
                temperature: CONFIG.TEMPERATURE,
                maxTokens: CONFIG.MAX_TOKENS,
                topP: CONFIG.TOP_P
            });

            console.log(`\n[LOOP] finish_reason: "${chatResponse.finishReason}" · ${chatResponse.iterations} tool iteration(s)`);
            for (const tool of chatResponse.tools) {
                console.log(`[TOOL] Executing: ${tool.name}(${tool.arguments})`);
                console.log(`[TOOL] Result: ${tool.result}`);
            }

            const lastMessage = chatResponse.messages[chatResponse.messages.length - 1];
            const assistantMessage = messagePreview(lastMessage);
            console.log(`\nAssistant: ${assistantMessage}`);
            console.log(`\n[TOKENS] ${chatResponse.tokenCount} tokens · ${chatResponse.messages.length} messages · ~${countTokens(chatResponse.messages)} history tokens (est.) · ${chatResponse.totalLatencyMs}ms\n`);
        } catch (error) {
            console.error("Error generating chat response:", error);
        }
    }
};

startCli();