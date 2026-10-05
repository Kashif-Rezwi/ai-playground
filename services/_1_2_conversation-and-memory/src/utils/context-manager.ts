import { Message } from "./types";
import { hardTruncation } from "./trim-strategy/hardTruncation";
import { slidingWindow } from "./trim-strategy/slidingWindow";
import { summarization } from "./trim-strategy/summarization/summarization";
import { tokenAwareTrimming } from "./trim-strategy/tokenAwareTrimming";

export async function prepareContext(messages: Message[]): Promise<Message[]> {
    // return hardTruncation(messages);
    // return slidingWindow(messages);
    // return await summarization(messages);
    return tokenAwareTrimming(messages);
}