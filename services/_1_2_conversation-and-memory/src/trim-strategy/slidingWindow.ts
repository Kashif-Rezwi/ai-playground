import { Message } from "../types";
import { MAX_TURNS_TO_KEEP } from "../config";

export function slidingWindow(messages: Message[]): Message[] {
    // 1 turn = 2 messages (user + assistant).
    // Total messages allowed = (MAX_TURNS_TO_KEEP * 2) + 1 (for the system prompt) + 1 (for the new user message currently being processed)
    const maxMessages = (MAX_TURNS_TO_KEEP * 2) + 2;

    if (messages.length <= maxMessages) {
        return messages;
    }

    console.log(`🪟  [SLIDING WINDOW] Sliding history to keep only the last ${MAX_TURNS_TO_KEEP} turns.`);

    // Extract system prompt
    const systemPrompt = messages[0];

    // Because we always slice off exactly 2 messages at a time (the oldest user/assistant pair),
    // we guarantee the sequence remains unbroken.
    const messagesToKeep = messages.slice(messages.length - (MAX_TURNS_TO_KEEP * 2));

    // Remember, the very latest message is the 'user' prompt we just added, so there might be an odd number at this exact moment in the loop.
    return [systemPrompt, ...messagesToKeep];
}
