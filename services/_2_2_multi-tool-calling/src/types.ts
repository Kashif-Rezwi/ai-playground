import OpenAI from "openai";

// Type alias for OpenAI's chat messages
export type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

// Type alias for a tool call request from the model
export type ToolCall = OpenAI.Chat.Completions.ChatCompletionMessageToolCall;

// Type alias for our tool definitions
export type ToolDefinition = OpenAI.Chat.Completions.ChatCompletionTool;
