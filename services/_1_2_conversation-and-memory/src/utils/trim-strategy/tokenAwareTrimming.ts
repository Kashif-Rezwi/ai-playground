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

    // SAFETY CHECK: If trimming left an assistant message right after the system
    // prompt, remove it so the history always starts with a user message and
    // preserves the alternating user -> assistant turn structure.
    if (messages[1]?.role === "assistant") {
        messages.splice(1, 1);
        console.log(`\n[TRIMMING] Removing orphaned assistant message to preserve turn structure.`);
    }

    return messages;
}