// Message Parameters we send to the API (role + content)
export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

// POST /api/chat/generate request body
export interface GenerateChatRequest {
    systemPrompt?: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
}

// POST /api/chat/generate response body
export interface GenerateChatResponse {
    messages: Message[];
    tokenCount: number;
}
