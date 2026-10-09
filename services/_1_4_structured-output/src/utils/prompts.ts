import { ApproachParams, ReviewMode } from "./types";

// The expected shape of the JSON object returned by the model, as described in the prompt.
const REVIEW_SHAPE = [
    "{",
    '  "language": string (detected programming language),',
    '  "summary": string (one paragraph overview),',
    '  "overallScore": number (0-100 quality score),',
    '  "recommendation": "approve" | "request_changes" | "needs_major_work",',
    '  "issues": array of { "severity": "critical" | "warning" | "suggestion", "line": number or null, "title": string, "description": string },',
    '  "strengths": array of strings,',
    '  "metrics": { "readability": number (0-10), "maintainability": number (0-10), "testability": number (0-10) }',
    "}",
].join("\n");

// Approach 1 — Prompt Engineering (Naive): instruction-following only.
export const SYSTEM_PROMPT = [
    "You are an expert code reviewer.",
    "Analyze the user's code and respond with a SINGLE valid JSON object — nothing else.",
    "No markdown code fences, no explanations, no apology text, no text before or after the JSON.",
    "The JSON object must have EXACTLY this shape:",
    REVIEW_SHAPE,
].join("\n");

// Approach 2 — JSON Mode: the API enforces valid JSON *syntax* 
// but not the *shape* of the object. Zod validation is still required.
export const JSON_MODE_SYSTEM_PROMPT = [
    "You are an expert code reviewer.",
    "Analyze the user's code and return your review as a JSON object.",
    "Valid JSON syntax is enforced by the API — but the shape must still be followed exactly.",
    "The JSON object must have EXACTLY this shape:",
    REVIEW_SHAPE,
].join("\n");

// The approach registry: mode → prompt + API-level enforcement knobs.
export function getModeApproachParams(mode: ReviewMode): ApproachParams {
    switch (mode) {
        case "prompt":
            // No API-level knobs — pure instruction-following
            return { systemPrompt: SYSTEM_PROMPT };
        case "json":
            // response_format enforces syntax, not shape — Zod validation stays on
            return { systemPrompt: JSON_MODE_SYSTEM_PROMPT, responseFormat: { type: "json_object" } };
        case "schema":
            // response_format: json_schema, built from the Zod schema
            throw new Error('Approach "schema" is not implemented yet.');
    }
}