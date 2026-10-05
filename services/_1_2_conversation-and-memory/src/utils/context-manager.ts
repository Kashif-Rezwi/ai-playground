import { Message } from "./types";
import CONFIG from "./config";
import { hardTruncation } from "./trim-strategy/hardTruncation";
import { slidingWindow } from "./trim-strategy/slidingWindow";
import { summarization } from "./trim-strategy/summarization/summarization";
import { tokenAwareTrimming } from "./trim-strategy/tokenAwareTrimming";

export async function prepareContext(messages: Message[]): Promise<Message[]> {
    switch (CONFIG.CONTEXT_STRATEGY) {
        case "hard-truncation":
            return hardTruncation(messages);
        case "sliding-window":
            return slidingWindow(messages);
        case "summarization":
            return await summarization(messages);
        case "token-aware":
            return tokenAwareTrimming(messages);
        default: return messages;
    }
}