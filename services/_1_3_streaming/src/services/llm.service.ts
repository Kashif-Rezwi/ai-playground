import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });
import { Groq } from "groq-sdk";

const llmApiKey = process.env.LLM_API_KEY;
if (!llmApiKey) {
    throw new Error("LLM_API_KEY is not set in the environment variables.");
}

const groqClient = new Groq({ apiKey: llmApiKey });

export default groqClient;