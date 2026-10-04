import { Message } from "./types";
import { get_encoding } from "tiktoken";

export function countTokens(messages: Message[]): number {
    const enc = get_encoding("o200k_base");
    let total = 0;
    for (const msg of messages) {
        total += 4; // overhead per message (role + formatting tokens)
        total += enc.encode(msg.content).length;
    }
    enc.free(); // always free the encoder to prevent memory leaks
    return total;
}