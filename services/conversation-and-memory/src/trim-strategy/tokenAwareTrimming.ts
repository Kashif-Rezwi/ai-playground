import { Message } from "../types";
import { countTokens } from "../countTokens";
import { MAX_CONTEXT_TOKENS, MAX_RESPONSE_TOKENS } from "../config";

export function tokenAwareTrimming(messages: Message[]): Message[] {
    const historyBudget = MAX_CONTEXT_TOKENS - MAX_RESPONSE_TOKENS;

    // Always keep system prompt at index 0, trim oldest messages
    while (countTokens(messages) > historyBudget && messages.length > 1) {
        // Remove the oldest non-system message (index 1)
        messages.splice(1, 1);
        console.log(`⚠️  [TRIM] Removed oldest message to stay within history budget (${historyBudget} tokens).`);
    }
    return messages;
}