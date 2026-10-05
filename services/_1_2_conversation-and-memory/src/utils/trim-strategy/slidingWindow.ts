import { Message } from "../types";
import CONFIG from "../config";

export function slidingWindow(messages: Message[]): Message[] {
    // 1 turn = 2 messages (user + assistant).
    // Total messages allowed = (MAX_TURNS_TO_KEEP * 2) + 1 (system prompt) + 1 (new user message)
    const maxMessages = (CONFIG.MAX_TURNS_TO_KEEP * 2) + 2;

    // If the number of messages is within the limit, return them as is.
    if (messages.length <= maxMessages) {
        return messages;
    }

    console.log(`\n[SLIDING WINDOW] Sliding history to keep only the last ${CONFIG.MAX_TURNS_TO_KEEP} turns...`);

    // Extract system prompt
    const systemPrompt = messages[0];

    // Keep only the last (MAX_TURNS_TO_KEEP * 2) messages, which corresponds to the last MAX_TURNS_TO_KEEP turns.
    const messagesToKeep = messages.slice(messages.length - (CONFIG.MAX_TURNS_TO_KEEP * 2));

    // SAFETY CHECK: If the window starts with an assistant message (which happens
    // when the latest user message is still unanswered), drop it so the history
    // always starts with a user message right after the system prompt.
    if (messagesToKeep[0]?.role === "assistant") {
        return [systemPrompt, ...messagesToKeep.slice(1)];
    }

    // Return the system prompt followed by the messages to keep.
    return [systemPrompt, ...messagesToKeep];
}
