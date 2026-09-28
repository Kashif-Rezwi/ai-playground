// src/experiment.ts
import dotenv from "dotenv";
import fs from "fs";
import OpenAI from "openai";
import { runReview } from "./reviewers";
import { CodeReviewSchema } from "./schema";
import { ReviewMode } from "./types";

dotenv.config({ path: "../../.env" });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const RUNS_PER_MODE = 5; // Set to 5 so we don't wait forever, but you can change it to 10!
const MODES: ReviewMode[] = ["prompt", "json", "schema"];

async function runExperiments() {
    const code = fs.readFileSync("sample/sample.txt", "utf-8");

    console.log(`\n\x1b[1m🧪 STARTING EXPERIMENTS (${RUNS_PER_MODE} runs per mode)\x1b[0m\n`);

    for (const mode of MODES) {
        let jsonParseFails = 0;
        let zodValidationFails = 0;
        let perfectSuccess = 0;

        process.stdout.write(`Testing [${mode.toUpperCase()}] mode `);

        for (let i = 0; i < RUNS_PER_MODE; i++) {
            process.stdout.write("."); // Print a dot so we know it's working

            const rawResponse = await runReview(code, mode, client);

            let parsed: unknown;
            try {
                parsed = JSON.parse(rawResponse);
            } catch {
                jsonParseFails++;
                continue; // Move to next run, this one totally failed
            }

            const result = CodeReviewSchema.safeParse(parsed);
            if (!result.success) {
                zodValidationFails++;
            } else {
                perfectSuccess++;
            }
        }

        console.log("\n");
        console.log(`  📊 RESULTS FOR ${mode.toUpperCase()}:`);
        console.log(`  ✅ Perfect Schema Matches: ${perfectSuccess}/${RUNS_PER_MODE}`);
        if (jsonParseFails > 0) console.log(`  ❌ JSON Parsing Failed:    ${jsonParseFails}`);
        if (zodValidationFails > 0) console.log(`  ❌ Zod Validation Failed:  ${zodValidationFails}`);
        console.log("--------------------------------------------------\n");
    }
}

runExperiments().catch(console.error);
