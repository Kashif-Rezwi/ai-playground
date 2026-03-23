import OpenAI from "openai";
import { Message } from "../../types";
import { countTokens } from "../../countTokens";
import { MAX_CONTEXT_TOKENS, MODEL } from "../../config";
import { SUMMARIZATION_PROMPT } from "./prompt";

export async function summarization(
    messages: Message[],
    client: OpenAI
): Promise<Message[]> {
    // 1. Check if we actually need to summarize
    if (countTokens(messages) <= MAX_CONTEXT_TOKENS) {
        return messages; // We are under budget, do nothing
    }

    console.log(`🧠 [SUMMARIZE] Token budget exceeded. Generating summary of old messages...`);

    // 2. We want to keep the main system prompt (index 0)
    const systemPrompt = messages[0];

    // 3. We want to keep the most recent 4 messages (2 turns) completely untouched
    // so the immediate conversation flows naturally.
    const recentMessages = messages.slice(-4);

    // 4. Everything in between is "old history" that we will summarize
    // slice(1, -4) grabs everything from index 1 up to the last 4 elements
    const messagesToSummarize = messages.slice(1, -4);

    if (messagesToSummarize.length === 0) {
        // Edge case: Sometimes single messages are just too giant, so slicing like this leaves nothing.
        // In that rare case, just return the truncated version.
        return [systemPrompt, ...recentMessages];
    }

    // 5. Convert the old messages into a string transcript for the LLM to read
    const transcriptString = messagesToSummarize
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");

    // 6. Ask the LLM to summarize it!
    const summaryResponse = await client.chat.completions.create({
        model: MODEL,
        messages: [
            {
                role: "system",
                content: SUMMARIZATION_PROMPT,
            },
            {
                role: "user",
                content: transcriptString,
            },
        ],
        temperature: 0.3, // Low temperature for factual consistency
        max_tokens: 300,
    });

    const summaryText = summaryResponse.choices[0].message.content ?? "No summary generated.";
    console.log(`✅ [SUMMARIZE] Summary created: "${summaryText.substring(0, 50)}..."`);

    // 7. Rebuild the history: System Prompt + Summary (as a system message) + Recent Turns
    const summaryMessage: Message = {
        role: "system",
        content: `Summary of earlier conversation: ${summaryText}`,
    };

    return [systemPrompt, summaryMessage, ...recentMessages];
}
