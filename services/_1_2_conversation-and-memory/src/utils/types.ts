export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface GenerateChatRequest {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
};

export interface GenerateChatResponse {
    messages: Message[];
    tokenCount: number;
}