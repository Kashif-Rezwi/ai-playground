import { Message } from "./types";
import { encoding_for_model } from "tiktoken";

export function countTokens(messages: Message[]): number {
    const enc = encoding_for_model("gpt-4o-mini");
    let total = 0;
    for (const msg of messages) {
        total += 4; // overhead per message (role + formatting tokens)
        total += enc.encode(msg.content).length;
    }
    enc.free(); // always free the encoder to prevent memory leaks
    return total;
}