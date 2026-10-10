import { createInterface } from "readline";
import { existsSync, readFileSync, statSync } from "fs";
import chatService from "./services/chat.service";
import { formatReview } from "./utils/formatter";
import { ReviewMode, RunStats } from "./utils/types";

const VALID_MODES: ReviewMode[] = ["prompt", "json", "schema"];

// Stats footer: approach, retries, tokens in/out, total latency
function printStatsFooter(stats: RunStats): void {
    console.log(`── approach: ${stats.approach} · retries: ${stats.retries} · tokens ${stats.inputTokens} in / ${stats.outputTokens} out · ${stats.totalLatencyMs}ms ──\n`);
}

// Read the snippet from a file path, with friendly errors.
function readCodeFile(path: string): string | null {
    try {
        if (!existsSync(path) || !statSync(path).isFile()) {
            console.log(`\nFile not found: ${path}\n`);
            return null;
        }
        return readFileSync(path, "utf-8");
    } catch (error) {
        console.log(`\nCould not read file: ${path} (${(error as Error).message})\n`);
        return null;
    }
}

// Piped stdin → one-shot: the entire stdin IS the code snippet (doc requirement #1, "stdin" half)
async function runOneShotStdin(mode: ReviewMode): Promise<void> {
    const code = await new Promise<string>((resolve) => {
        let full = "";
        process.stdin.setEncoding("utf-8");
        process.stdin.on("data", (chunk: string) => (full += chunk));
        process.stdin.on("end", () => resolve(full));
    });

    if (!code.trim()) {
        console.error("No code received on stdin.");
        process.exit(1);
    }

    try {
        const { review, stats } = await chatService.generateStructuredOutput({ code, mode });
        console.log(formatReview(review));
        printStatsFooter(stats);
        process.exit(0);
    } catch (error) {
        console.error(`Review failed: ${(error as Error).message}`);
        process.exit(1);
    }
}

async function startCli(): Promise<void> {
    let currentMode = "prompt" as ReviewMode;

    // Interactive review REPL — the main flow
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("Code Review CLI started.");
    console.log("Commands: /mode [prompt|json|schema], /exit");
    console.log(`Current mode: ${currentMode}\n`);

    let running = true;

    // Gracefully stop the CLI on Ctrl+C
    rl.on("close", () => {
        running = false;
        console.log("\nGoodbye!\n");
    });

    while (running) {
        const input = await new Promise<string>((resolve) => {
            rl.question("File path: ", (answer) => resolve(answer.trim()));
        }).catch(() => ""); // readline was closed mid-question

        if (!running) break;

        if (input === "/exit") {
            rl.close();
            break;
        }

        if (input === "/mode") {
            console.log(`\nCurrent mode: ${currentMode} (valid: ${VALID_MODES.join(", ")})\n`);
            continue;
        }

        if (input.startsWith("/mode ")) {
            const requested = input.slice("/mode ".length).trim() as ReviewMode;
            if (!VALID_MODES.includes(requested)) {
                console.log(`\nInvalid mode '${requested}'. Valid: ${VALID_MODES.join(", ")}\n`);
                continue;
            }
            currentMode = requested;
            console.log(`\nMode switched to: ${currentMode}\n`);
            continue;
        }

        if (!input) continue;

        // Read the code snippet from the specified file path, with friendly errors.
        const code = readCodeFile(input);
        if (code === null) continue;

        try {
            const { review, stats } = await chatService.generateStructuredOutput({ code, mode: currentMode });
            console.log(formatReview(review));
            printStatsFooter(stats);
        } catch (error) {
            // e.g. retries exhausted — the [RETRY n/2] trail was already logged by the service
            console.error(`\nReview failed: ${(error as Error).message}\n`);
        }
    }
}

startCli();