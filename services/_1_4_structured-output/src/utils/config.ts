import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const CONFIG = {
    // API Configuration
    LLM_API_KEY: process.env.LLM_API_KEY || "",

    // LLM Configuration
    MODEL: "openai/gpt-oss-20b",
    MAX_TOKENS: 6000, // due to reasoning model max tokens needs to be set to 6000.
    TEMPERATURE: 0.2,
    TOP_P: 1,

    // Retry Configuration
    MAX_RETRIES: 2,
};

export default CONFIG;
