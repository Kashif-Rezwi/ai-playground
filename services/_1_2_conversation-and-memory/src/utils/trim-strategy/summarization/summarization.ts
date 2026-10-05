import groqClient from "../../../services/llm.service";
import { countTokens } from "../../countTokens";
import { Message } from "../../types";
import CONFIG from "../../config";

export async function summarization(messages: Message[]): Promise<Message[]> {
    // Check if we actually need to summarize, else return the messages as is.
    if (countTokens(messages) <= CONFIG.MAX_CONTEXT_TOKENS) {
        return messages;
    }

    console.log(`\n[SUMMARIZE] Token budget exceeded. Generating summary of old messages...`);

    // Extract the system prompt
    const systemPrompt = messages[0];

    // Extract the messages not inclding in summarization (the last 4 messages, which is 2 turns)
    const recentMessages = messages.slice(-(CONFIG.TURNS_TO_KEEP_BEFORE_SUMMARIZATION * 2));

    // Extract the messages to summarize (everything except the system prompt and the last 4 messages)
    const messagesToSummarize = messages.slice(1, -(CONFIG.TURNS_TO_KEEP_BEFORE_SUMMARIZATION * 2));

    if (messagesToSummarize.length === 0) {
        // Edge case: If there are no messages to summarize
        return [systemPrompt, ...recentMessages];
    }

    // Convert the old messages into a string transcript for the LLM to read
    const transcriptString = messagesToSummarize
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");

    // Initialize the summarization client
    const summaryResponse = await groqClient.chat.completions.create({
        model: CONFIG.MODEL,
        messages: [
            {
                role: "system",
                content: CONFIG.SUMMARIZATION_PROMPT,
            },
            {
                role: "user",
                content: transcriptString,
            },
        ],
        temperature: CONFIG.SUMMARIZATION_TEMPERATURE,
        max_tokens: CONFIG.SUMMARIZATION_MAX_TOKENS,
    });

    const summaryText = summaryResponse.choices[0].message.content ?? "No summary generated.";
    console.log(`\n[SUMMARIZE] Summary created: "\n${summaryText.substring(0, 50)}..."`);

    // Rebuild the history: System Prompt + Summary (as a system message) + Recent Turns
    const summaryMessage: Message = {
        role: "system",
        content: `Summary of earlier conversation: ${summaryText}`,
    };

    return [systemPrompt, summaryMessage, ...recentMessages];
}
