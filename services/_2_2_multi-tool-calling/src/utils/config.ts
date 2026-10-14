import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const CONFIG = {
    // API Configuration
    LLM_API_KEY: process.env.LLM_API_KEY || "",

    // LLM Configuration
    MODEL: "openai/gpt-oss-20b", // it is a reasoning model.
    MAX_TOKENS: 6000, // reasoning models token consumption is high, so a higher limit is needed.
    TEMPERATURE: 0.2,
    TOP_P: 1,

    // Tool Configuration
    TOOL_CHOICE: "auto" as "auto" | "required" | "none",
    MAX_TOOL_ITERATIONS: 5,   // multi-tool phase legitimately needs 2–3 rounds; cap at 5

    // Retry Configuration
    MAX_TOOL_CALL_RETRIES: 3,
    TEMPERATURE_RETRY_STEP: 0.2,
    MIN_TEMPERATURE: 0.2,
};

export default CONFIG;
