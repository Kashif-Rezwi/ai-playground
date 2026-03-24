import { OpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { CodeReviewSchema } from "./schema";
import { ReviewMode } from "./types";

const MODEL = "gpt-4o-mini";
const MAX_TOKENS = 1000;
const TEMPERATURE = 0.2;

const SYSTEM_PROMPTS: Record<ReviewMode, string> = {
    prompt: "You are a code reviewer. Return your review as a single valid JSON object matching this shape exactly: { language, summary, overallScore, recommendation, issues, strengths, metrics }. No markdown, no explanation — just the JSON object.",
    json: "You are an expert code reviewer. Return a JSON code review with fields: language, summary, overallScore, recommendation, issues, strengths, metrics.",
    schema: "You are an expert code reviewer. Analyze the provided code and return a structured review.",
};

// Dispatches the correct reviewer function based on the selected mode
export async function runReview(code: string, mode: ReviewMode, client: OpenAI): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPTS[mode] },
        { role: "user", content: code },
    ];

    const baseParams = {
        model: MODEL,
        messages,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE
    };

    switch (mode) {
        case "prompt": {
            const res = await client.chat.completions.create(baseParams);
            return res.choices[0].message.content ?? "";
        }
        case "json": {
            const res = await client.chat.completions.create({
                ...baseParams,
                response_format: { type: "json_object" },
            });
            return res.choices[0].message.content ?? "";
        }
        case "schema": {
            const res = await client.chat.completions.create({
                ...baseParams,
                response_format: zodResponseFormat(CodeReviewSchema, "CodeReview"),
            });
            return res.choices[0].message.content ?? "";
        }
    }
}
