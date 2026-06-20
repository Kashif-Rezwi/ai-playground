import readline from 'readline';
import { runTurn } from './runner';
import { SYSTEM_PROMPT } from './config';
import { Message } from './types';

// Setup readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// The state of our conversation
const history: Message[] = [
    { role: "system", content: SYSTEM_PROMPT }
];

console.log("[Multi-Tool Calling] Travel Agent CLI (Phase 2.2) Started!");
console.log("Type your message, or type '/history' to see the raw message array. Type 'exit' to quit.\n");

function askQuestion() {
    rl.question('\nYou: ', async (input: string) => {
        const text = input.trim();

        if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'quit') {
            console.log('Goodbye!');
            rl.close();
            return;
        }

        if (text === '/history') {
            console.log("\n=== CONVERSATION HISTORY ===");
            console.log(JSON.stringify(history, null, 2));
            console.log("============================");
            askQuestion();
            return;
        }

        if (!text) {
            askQuestion();
            return;
        }

        // 1. Add the user's message to history
        history.push({ role: "user", content: text });

        try {
            // 2. Run the turn (which handles 1 or 2 API calls internally)
            const finalMessage = await runTurn(history);

            // 3. Print the result
            console.log(`\nAgent: ${finalMessage.content}`);

            // 4. Add the final message to history
            history.push(finalMessage);
        } catch (error: any) {
            console.error("\n❌ Error during turn:", error.message);
        }

        // Loop
        askQuestion();
    });
}

// Start the loop
askQuestion();
