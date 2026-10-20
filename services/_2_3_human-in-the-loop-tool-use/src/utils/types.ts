import type { ChatCompletionMessageParam, ChatCompletionTool } from 'groq-sdk/resources/chat/completions';

// Define the Message type based on the ChatCompletionMessageParam from the groq-sdk
export type Message = ChatCompletionMessageParam;

// Tool Definition we send to the API (name + description + parameters)
export type ToolDefinition = ChatCompletionTool;

// POST /api/chat/generate request body
export interface GenerateChatRequest {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

// POST /api/chat/generate response body (run envelope — can later represent pending work)
export interface GenerateChatResponse {
  messages: Message[];
  tokenCount: number;
}
