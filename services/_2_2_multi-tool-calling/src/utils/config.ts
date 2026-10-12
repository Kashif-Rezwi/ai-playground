import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

const CONFIG = {
    // API Configuration
    LLM_API_KEY: process.env.LLM_API_KEY || "",

    // LLM Configuration
    MODEL: "openai/gpt-oss-20b", // it is a reasoning model.
    MAX_TOKENS: 6000, // reasoning models token consumption is high, so a higher limit is needed.
    TEMPERATURE: 0.2,
    TOP_P: 1,
};

export default CONFIG;
