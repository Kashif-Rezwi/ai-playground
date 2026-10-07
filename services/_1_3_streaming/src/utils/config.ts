import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

const CONFIG = {
    LLM_API_KEY: process.env.LLM_API_KEY || "",
    TEMPERATURE: 0.7,
    // openai/gpt-oss-20b is a reasoning model:
    // reasoning tokens count against max_tokens and are generated before any content, 
    // so the budget must leave room for reasoning + the answer (1000 can be fully consumed by reasoning alone, leaving no visible tokens).
    MAX_TOKENS: 4000,
    TOP_P: 1,
    MODEL: "openai/gpt-oss-20b",
    SYSTEM_PROMPT: "You are a helpful assistant.",
};

export default CONFIG;