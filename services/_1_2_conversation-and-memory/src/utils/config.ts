import { SummarizationPrompt } from "./trim-strategy/summarization/prompt";
import { ContextStrategy } from "./types";

const CONFIG = {
    TEMPERATURE: 0.7,
    MAX_TOKENS: 1000,
    TOP_P: 1,
    MODEL: "openai/gpt-oss-20b",
    SYSTEM_PROMPT: "You are a helpful assistant. Keep all responses brief and concise, limited to 2-5 sentences maximum.",
    // hard truncation 
    MAX_MESSAGES_TO_KEEP: 11,
    // sliding window
    MAX_TURNS_TO_KEEP: 5,
    // summarization
    MAX_CONTEXT_TOKENS: 1000,
    SUMMARIZATION_PROMPT: SummarizationPrompt,
    TURNS_TO_KEEP_BEFORE_SUMMARIZATION: 2,
    SUMMARIZATION_TEMPERATURE: 0.3,
    SUMMARIZATION_MAX_TOKENS: 300,
    // token-aware trimming
    MAX_RESPONSE_TOKENS: 500,
    // context management strategy: "hard-truncation" | "sliding-window" | "summarization" | "token-aware"
    CONTEXT_STRATEGY: "token-aware" as ContextStrategy,
};

// Message limit should be a odd number to ensure the system prompt is always preserved.

export default CONFIG;