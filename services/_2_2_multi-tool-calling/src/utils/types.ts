import type { ChatCompletionMessageParam, ChatCompletionTool } from "groq-sdk/resources/chat/completions";

// Message Parameters we send to the API (role + content)
export type Message = ChatCompletionMessageParam;

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

// Tool Definition we send to the API (name + description + parameters)
export type ToolDefinition = ChatCompletionTool;
