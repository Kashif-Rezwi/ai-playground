export const MODEL = "gpt-4o-mini";
export const MAX_CONTEXT_TOKENS = 2000;
export const MAX_RESPONSE_TOKENS = 500;
export const SYSTEM_PROMPT = "You are a helpful assistant.";

// hard truncation: 5 means System + 2 User/Assistant pairs
export const MAX_MESSAGES_TO_KEEP = 10;

// sliding window: How many full conversational turns to keep
export const MAX_TURNS_TO_KEEP = 2;