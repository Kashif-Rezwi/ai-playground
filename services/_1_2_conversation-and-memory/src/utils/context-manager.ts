import { Message } from "./types";
import { hardTruncation } from "./trim-strategy/hardTruncation";
import { slidingWindow } from "./trim-strategy/slidingWindow";

export function prepareContext(messages: Message[]): Message[] {
    // return hardTruncation(messages);
    return slidingWindow(messages);
}