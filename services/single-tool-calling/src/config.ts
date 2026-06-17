import dotenv from 'dotenv';
dotenv.config();

// Ensure the API key is present
if (!process.env.OPENAI_API_KEY) {
    console.error("❌ ERROR: OPENAI_API_KEY is missing in your environment.");
    process.exit(1);
}

// We use a fast, cheap model for tool calling experiments
export const MODEL = "gpt-4o-mini";

// The foundational system prompt that grounds the model's behavior
export const SYSTEM_PROMPT = `
You are a helpful AI weather assistant. 
You have access to tools to look up the current weather.
When asked about the weather, ALWAYS use your tool. Do not guess or make up weather data.
If the user asks a general question unrelated to the weather, answer it directly without calling tools.
`.trim();
