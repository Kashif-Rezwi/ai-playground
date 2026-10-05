import { Message } from "../types";
import { countTokens } from "../countTokens";
import CONFIG from "../config";

export function tokenAwareTrimming(messages: Message[]): Message[] {
    const historyBudget = CONFIG.MAX_CONTEXT_TOKENS - CONFIG.MAX_RESPONSE_TOKENS;

    // Always keep system prompt at index 0, trim oldest messages
    while (countTokens(messages) > historyBudget && messages.length > 1) {
        // Remove the oldest non-system message (index 1)
        messages.splice(1, 1);
        console.log(`\n[TRIMMING] Removing oldest message from the history...`);
        console.log(`[TRIMMED] Total Token Budget: ${historyBudget} tokens, Current token count: ${countTokens(messages)} tokens.`);
    }
    return messages;
}