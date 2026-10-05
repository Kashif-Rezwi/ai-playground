const CONFIG = {
    TEMPERATURE: 0.7,
    MAX_TOKENS: 1000,
    TOP_P: 1,
    MODEL: "openai/gpt-oss-20b",
    SYSTEM_PROMPT: "You are a helpful assistant.",
    // hard truncation 
    MAX_MESSAGES_TO_KEEP: 11,
    // sliding window
    MAX_TURNS_TO_KEEP: 5
};

// Message limit should be a odd number to ensure the system prompt is always preserved.

export default CONFIG;