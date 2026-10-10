import type { ChatCompletionMessageParam, ChatCompletionTool } from "groq-sdk/resources/chat/completions";

// Message Parameters we send to the API (role + content)
export type Message = ChatCompletionMessageParam;

// Tool Definition we send to the API (name + description + parameters)
export type ToolDefinition = ChatCompletionTool;

// POST /api/chat/generate request body
export interface GenerateChatRequest {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
}

// The tool call trace for observability and debugging. This is returned in the API response.
export interface ToolTrace {
    name: string;
    arguments: string;
    result: string;
}

// POST /api/chat/generate response body
export interface GenerateChatResponse {
    messages: Message[];
    tokenCount: number;
    tool: ToolTrace | null; // last tool call trace
    tools: ToolTrace[];
    iterations: number; // model→tool iterations
    finishReason: string | null;
    totalLatencyMs: number;
}