import { Message } from "./types";
import { countTokens } from "./countTokens";
import { MAX_CONTEXT_TOKENS } from "./config";

export function trimHistory(messages: Message[]): Message[] {
    // Always keep system prompt at index 0, trim oldest messages
    while (countTokens(messages) > MAX_CONTEXT_TOKENS && messages.length > 1) {
        // Remove the oldest non-system message (index 1)
        messages.splice(1, 1);
        console.log("⚠️  [TRIM] Removed oldest message to stay within token budget.");
    }
    return messages;
}