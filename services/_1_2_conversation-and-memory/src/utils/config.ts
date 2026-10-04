const CONFIG = {
    TEMPERATURE: 0.7,
    MAX_TOKENS: 1000,
    TOP_P: 1,
    MODEL: "openai/gpt-oss-20b",
    SYSTEM_PROMPT: "You are a helpful assistant.",
    // hard truncation message limit should be a odd number,
    // to ensure the system prompt is always preserved.
    MAX_MESSAGES_TO_KEEP: 11,
};

export default CONFIG;