import dotenv from 'dotenv';
import path from 'path';

// Load the .env from the root of the project
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Ensure the API key is present
if (!process.env.OPENAI_API_KEY) {
    console.error("❌ ERROR: OPENAI_API_KEY is missing in your environment.");
    process.exit(1);
}

// The model to use. GPT-4o-mini is fast and great at tool calling.
export const MODEL = "gpt-4o-mini";

// Max tokens for the model's response
export const MAX_RESPONSE_TOKENS = 1000;

// The system prompt defines the agent's persona and constraints.
export const SYSTEM_PROMPT = `You are a helpful travel assistant.
You have access to tools that can check the weather, check the current time, and convert currencies.

Follow these rules:
1. If the user asks for information covered by your tools, ALWAYS call the appropriate tool.
2. If the user asks for multiple pieces of information (e.g. weather and time), call all necessary tools in parallel.
3. If a tool returns an error, gracefully explain the issue to the user using the available information.
4. Never guess or make up data for weather, time, or exchange rates.`;
