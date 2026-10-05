import { Message } from "../types";
import CONFIG from "../config";

export function hardTruncation(messages: Message[]): Message[] {
    // If we are under the limit, do nothing
    if (messages.length <= CONFIG.MAX_MESSAGES_TO_KEEP) {
        return messages;
    }

    console.log(`\n[TRUNCATE] History exceeded ${CONFIG.MAX_MESSAGES_TO_KEEP} messages. Truncating...`);

    // Always extract the system prompt first so we don't lose it
    const systemPrompt = messages[0];

    // Get the most recent N-1 messages from the end of the array
    const recentMessages = messages.slice(-(CONFIG.MAX_MESSAGES_TO_KEEP - 1));

    // Combine them back together
    const newHistory = [systemPrompt, ...recentMessages];

    return newHistory;
}
