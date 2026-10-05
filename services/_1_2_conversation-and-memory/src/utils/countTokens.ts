import { Message } from "./types";
import { get_encoding } from "tiktoken";

// Create the encoder once and reuse it across calls. (efficient because the encoder is stateless and can be reused)
const encoder = get_encoding("o200k_base");

export function countTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
        total += 4; // overhead per message (role + formatting tokens)
        total += encoder.encode(msg.content).length;
    }
    return total;
}