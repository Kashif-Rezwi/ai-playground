import { executeTool } from "../tools/registry";
import { Message, ToolTrace } from "./types";

export interface ToolCallInput {
    id: string;
    type: string;
    function?: {
        name: string;
        arguments: string;
    };
}

export function executeToolBatch(
    toolCalls: readonly ToolCallInput[],
    appendMessage: (message: Message) => void
): ToolTrace[] {
    return toolCalls.map((toolCall) => {
        const functionCall = toolCall.function;
        const hasFunctionCall = toolCall.type === "function" && functionCall !== undefined;
        const toolName = hasFunctionCall ? functionCall.name : toolCall.type;
        const toolArgs = hasFunctionCall ? functionCall.arguments : "{}";

        let result: string;
        if (!hasFunctionCall) {
            result = JSON.stringify({ error: `Unsupported tool call type: ${toolCall.type}.` });
        } else {
            try {
                result = executeTool(toolName, toolArgs);
            } catch {
                result = JSON.stringify({ error: "Tool execution failed unexpectedly." });
            }
        }

        appendMessage({ role: "tool", tool_call_id: toolCall.id, content: result });

        return { name: toolName, arguments: toolArgs, result };
    });
}