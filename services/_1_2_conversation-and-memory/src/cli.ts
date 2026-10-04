import { createInterface } from "readline";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

async function startCli() {
    console.log('Chat started. Type "exit" to quit.\n');

    while (true) {
        const userPrompt = await new Promise((resolve) => {
            rl.question("You: ", (input) => resolve(input.trim()));
        });

        if (userPrompt === "exit") {
            console.log("Goodbye!");
            rl.close();
            break;
        }

        if (!userPrompt) continue;

        try {
            const response = await fetch(
                "http://localhost:3001/api/chat/generate",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        userPrompt,
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                console.error("Error:", result.error);
                continue;
            }

            const assistantMessage = result.messages[result.messages.length - 1].content;
            console.log(`\nAssistant: ${assistantMessage}\n`);
        } catch (error) {
            console.error("Could not connect to the chat server:", error);
        }
    }
};

startCli();
    