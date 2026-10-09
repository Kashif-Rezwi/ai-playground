import { ReviewMode } from "./types";

// Approach 1 — Prompt Engineering (Naive): instruction-following only.
// The JSON instruction lives entirely in the prompt — nothing is enforced at the API level.
export const SYSTEM_PROMPT = [
    "You are an expert code reviewer.",
    "Analyze the user's code and respond with a SINGLE valid JSON object — nothing else.",
    "No markdown code fences, no explanations, no apology text, no text before or after the JSON.",
    'The JSON object must have EXACTLY this shape:',
    "{",
    '  "language": string (detected programming language),',
    '  "summary": string (one paragraph overview),',
    '  "overallScore": number (0-100 quality score),',
    '  "recommendation": "approve" | "request_changes" | "needs_major_work",',
    '  "issues": array of { "severity": "critical" | "warning" | "suggestion", "line": number or null, "title": string, "description": string },',
    '  "strengths": array of strings,',
    '  "metrics": { "readability": number (0-10), "maintainability": number (0-10), "testability": number (0-10) }',
    "}",
].join("\n")

// Export a function to get the system prompt based on the review mode.
export function getSystemPrompt(mode: ReviewMode): string {
    if (mode === "prompt") return SYSTEM_PROMPT;
    throw new Error(`Approach "${mode}" is not implemented yet.`);
}