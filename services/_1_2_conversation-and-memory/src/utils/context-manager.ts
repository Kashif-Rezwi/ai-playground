import { Message } from "./types";
import { hardTruncation } from "./trim-strategy/hardTruncation";
import { slidingWindow } from "./trim-strategy/slidingWindow";
import { summarization } from "./trim-strategy/summarization/summarization";

export async function prepareContext(messages: Message[]): Promise<Message[]> {
    // return hardTruncation(messages);
    // return slidingWindow(messages);
    return await summarization(messages);
}