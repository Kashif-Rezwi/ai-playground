export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface ChatRequest {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
}

export interface StreamStats {
    ttftMs: number | null;
    totalMs: number | null;
    chunks: number;
    tokensPerSec: number | null;
    finishReason: string | null;
}