import { get_encoding } from "tiktoken";
import { Message } from "./types";

// Create the encoder once and reuse it across calls. (same pattern as _1_2)
const encoder = get_encoding("o200k_base");

// Extract countable text from any message shape, including tool calls/results
function messageText(msg: Message): string {
    const parts: string[] = [];
    const content = (msg as { content?: unknown }).content;

    // Handle the content based on its type: string, array, or object with a "text" property
    if (typeof content === "string") {
        parts.push(content);
    } else if (Array.isArray(content)) {
        for (const part of content) {
            if (typeof part === "string") parts.push(part);
            else if (part && typeof part === "object" && "text" in part) {
                parts.push(String((part as { text: unknown }).text ?? ""));
            } else parts.push(JSON.stringify(part));
        }
    }

    // Tool calls and tool call IDs are also counted as part of the message text
    const toolCalls = (msg as { tool_calls?: unknown }).tool_calls;
    if (Array.isArray(toolCalls)) parts.push(JSON.stringify(toolCalls));
    const toolCallId = (msg as { tool_call_id?: unknown }).tool_call_id;
    if (typeof toolCallId === "string") parts.push(toolCallId);

    // Join all parts with newlines to form the final text message
    return parts.join("\n");
}

export function countTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
        total += 4; // overhead per message (role + formatting tokens)
        total += encoder.encode(messageText(msg)).length;
    }
    return total;
}
