import { CodeReview } from "./schema";

// The three structured-output approaches (doc §Three Approaches)
export type ReviewMode = "prompt" | "json" | "schema";

// POST /api/chat/generate request body
export interface ReviewRequest {
    code: string;
    mode?: ReviewMode; // defaults to "prompt"
}

// Per-run observability stats
export interface RunStats {
    approach: ReviewMode;
    retries: number;
    inputTokens: number;
    outputTokens: number;
    totalLatencyMs: number;
}

// POST /api/chat/generate response body
export interface ReviewResult {
    review: CodeReview;
    stats: RunStats;
}

// Chat message shape for the Groq API
export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
}
