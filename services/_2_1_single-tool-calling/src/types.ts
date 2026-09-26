import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

// A Message is what goes into the history array (system, user, assistant, or tool)
export type Message = ChatCompletionMessageParam;

// A ToolDefinition is the JSON Schema we pass to the model so it knows what the tool does
export type ToolDefinition = ChatCompletionTool;

// A ToolCall is the object the model returns when it wants to execute a tool
export type ToolCall = {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
};
