import { createInterface } from 'readline';

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

const startCli = async () => {
    console.log("Structured Output CLI started.");
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

        if (userPrompt === "/exit") {
            rl.close();
            break;
        }

        if (!userPrompt) continue;

        console.log(`\nYou entered: ${userPrompt}\n`);
    }
}

startCli();