import readline from "readline";
import { ReviewMode } from "./types";

// Prompts the user to select a review mode from a list
export async function selectMode(): Promise<ReviewMode> {
    const options: { label: string; value: ReviewMode }[] = [
        { label: "Prompt Only        — instruction-following, no enforcement", value: "prompt" },
        { label: "JSON Mode          — guarantees valid JSON syntax", value: "json" },
        { label: "Schema Enforced    — guarantees valid JSON + correct shape", value: "schema" },
    ];

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("\n\x1b[1m? Select review mode:\x1b[0m");
    options.forEach((opt, i) => {
        const prefix = `  \x1b[90m${i + 1})\x1b[0m `;
        console.log(prefix + opt.label);
    });

    return new Promise((resolve) => {
        rl.question("\n\x1b[1m\x1b[36mEnter number (1-3):\x1b[0m ", (answer) => {
            rl.close();
            const index = parseInt(answer.trim()) - 1;
            if (index >= 0 && index < options.length) {
                const selected = options[index];
                console.log(`\n\x1b[90m› ${selected.label}\x1b[0m\n`);
                resolve(selected.value);
            } else {
                console.log("\x1b[90m› Invalid choice. Defaulting to Schema Enforced.\x1b[0m\n");
                resolve("schema");
            }
        });
    });
}
