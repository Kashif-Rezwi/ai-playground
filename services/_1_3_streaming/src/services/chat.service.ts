import CONFIG from "../utils/config";
import { ChatRequest, Message, StreamStats } from "../utils/types";
import groqClient from "./llm.service";

let conversationHistory: Message[] = [];

// Metrics for the most recent streamText call
let lastStreamStats: StreamStats = {
    ttftMs: null,
    totalMs: null,
    chunks: 0,
    tokensPerSec: null,
    finishReason: null,
};

const chatService = {
    async *streamText({ systemPrompt, userPrompt, temperature, maxTokens, topP }: ChatRequest): AsyncGenerator<string> {
        // Snapshot the current conversation history length for rollback in case of a failed stream.
        const historySnapshotLength = conversationHistory.length;

        // Add system prompt to conversation history if it's the first message
        if (conversationHistory.length === 0) {
            conversationHistory.push({ role: "system", content: systemPrompt });
        }
        conversationHistory.push({ role: "user", content: userPrompt });

        // Initialize an empty string to accumulate the assistant's response
        let assistantMessage = "";

        // Stream metrics (docs/streaming.md — Experiments 1, 2 and 6)
        let firstTokenAt = 0;
        let chunkCount = 0;
        let finishReason: string | null = null;
        const startedAt = Date.now();

        // Reset the per-turn stats up front; they are filled in on success.
        lastStreamStats = {
            ttftMs: null,
            totalMs: null,
            chunks: 0,
            tokensPerSec: null,
            finishReason: null,
        };

        // Marks a fully completed turn — only then is the history kept.
        let streamSucceeded = false;

        try {
            const rawResponse = await groqClient.chat.completions.create({
                model: CONFIG.MODEL,
                messages: conversationHistory,
                max_tokens: maxTokens,
                temperature,
                top_p: topP,
                stream: true,
            });

            for await (const chunk of rawResponse) {
                // Inspect finish_reason
                if (chunk.choices[0]?.finish_reason) {
                    finishReason = chunk.choices[0].finish_reason;
                }

                const delta = chunk.choices[0]?.delta?.content ?? "";

                if (delta) {
                    if (!firstTokenAt) {
                        firstTokenAt = Date.now();
                    }
                    assistantMessage += delta;
                    chunkCount += 1; // counts chunks
                    yield delta;
                }
            }

            const totalMs = Date.now() - startedAt;

            if (finishReason === "length") {
                console.warn(`Response truncated by max_tokens (finish_reason: "length") — the assistant message in history is incomplete.`);
            }

            // Append the assistant's response to history only after the stream
            conversationHistory.push({
                role: "assistant",
                content: assistantMessage,
            });
            streamSucceeded = true;

            lastStreamStats = {
                ttftMs: firstTokenAt ? firstTokenAt - startedAt : null,
                totalMs,
                chunks: chunkCount,
                tokensPerSec: totalMs > 0 ? Math.round((chunkCount / totalMs) * 1000) : null,
                finishReason,
            };
        } catch (error) {
            console.error(`Stream failed: ${(error as Error).message}`);
            throw error;
        } finally {
            if (!streamSucceeded) {
                // Roll back the conversation history to the last clean state if the stream failed
                conversationHistory = conversationHistory.slice(0, historySnapshotLength);
                console.warn("Partial response discarded. History restored to last clean state.");
            }
        }
    },

    async getConversationHistory(): Promise<Message[]> {
        return conversationHistory;
    },

    async clearHistory(): Promise<void> {
        // Reset the in-memory conversation history.
        conversationHistory = [];
    },

    async getStats(): Promise<StreamStats> {
        // Metrics for the most recent streamText call.
        return { ...lastStreamStats };
    },
}

export default chatService;