import { Message } from "../types";
import { MAX_MESSAGES_TO_KEEP } from "../config";

export function hardTruncation(messages: Message[]): Message[] {
    // If we are under the limit, do nothing
    if (messages.length <= MAX_MESSAGES_TO_KEEP) {
        return messages;
    }

    console.log(`✂️  [TRUNCATE] History exceeded ${MAX_MESSAGES_TO_KEEP} messages. Truncating...`);

    // Always extract the system prompt first so we don't lose it
    const systemPrompt = messages[0];

    // Get the most recent N-1 messages from the end of the array
    const recentMessages = messages.slice(-(MAX_MESSAGES_TO_KEEP - 1));

    // Combine them back together
    const newHistory = [systemPrompt, ...recentMessages];

    // Safety check: Did we accidentally make the history start with an 'assistant' message right after the system prompt?
    // If so, we need to drop it so it starts with a 'user' message.
    if (newHistory.length > 1 && newHistory[1].role === "assistant") {
        console.log("⚠️  [SAFETY] Truncation left an orphaned assistant message. Fixing sequence...");
        newHistory.splice(1, 1);
    }

    return newHistory;
}
