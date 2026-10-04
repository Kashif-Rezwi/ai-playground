import { Message } from "./types";
import { hardTruncation } from "./trim-strategy/hardTruncation";

export function prepareContext(messages: Message[]): Message[] {
    return hardTruncation(messages);
}