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

export interface ChatResponse {
    messages: Message[];
    tokenCount: number;
}