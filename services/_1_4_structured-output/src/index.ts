import dotenv from "dotenv";
import fs from "fs";
import OpenAI from "openai";
import { CodeReviewSchema } from "./schema";
import { selectMode } from "./selectMode";
import { runReview } from "./reviewers";
import { printReview } from "./formatter";

dotenv.config({ path: "../../.env" });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
    // 1. Resolve input file: ["npx tsx", "src/index.ts", "sample/sample.txt"]
    const filePath = process.argv[2];
    if (!filePath) throw new Error("Usage: npx tsx src/index.ts <path-to-file>");

    const code = fs.readFileSync(filePath, "utf-8");

    // 2. Select review mode interactively
    const mode = await selectMode();

    // 3. Call the API
    const rawResponse = await runReview(code, mode, client);

    // 4. Parse JSON
    let parsed: unknown;
    try {
        parsed = JSON.parse(rawResponse);
    } catch {
        console.error("❌ Failed to parse JSON response from API:");
        console.error(rawResponse);
        process.exit(1);
    }

    // 5. Validate shape with Zod
    const result = CodeReviewSchema.safeParse(parsed);
    if (!result.success) {
        console.error("❌ Schema validation failed:");
        result.error.issues.forEach((issue) =>
            console.error(`  • ${issue.path.join(".")} — ${issue.message}`)
        );

        // ADD THIS BLOCK:
        console.log("\n\x1b[90m--- RAW RESPONSE FROM AI ---\x1b[0m");
        console.log(rawResponse);
        console.log("\x1b[90m----------------------------\x1b[0m\n");

        process.exit(1);
    }

    // 6. Print the formatted review
    printReview(result.data, mode);
}

main().catch(console.error);
