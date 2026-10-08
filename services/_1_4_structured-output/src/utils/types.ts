// The three structured-output approaches (doc §Three Approaches)
export type ReviewMode = "prompt" | "json" | "schema";

// POST /api/chat/generate request body
export interface ReviewRequest {
    code: string;
    mode?: ReviewMode; // defaults to "prompt"
}

// Chat message shape for the Groq API
export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
}
