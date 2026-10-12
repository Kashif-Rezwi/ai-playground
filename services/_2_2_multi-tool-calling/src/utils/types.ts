
// POST /api/chat/generate request body
export interface GenerateChatRequest {
    systemPrompt?: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
}