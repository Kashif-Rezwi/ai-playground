import CONFIG from "../utils/config";
import { Groq } from "groq-sdk"

if (!CONFIG.LLM_API_KEY) {
    throw new Error("LLM_API_KEY is not set in the environment variables.");
}

const groqClient = new Groq({ apiKey: CONFIG.LLM_API_KEY });

export default groqClient;