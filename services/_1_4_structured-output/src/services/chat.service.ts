import groqClient from "./llm.service";
import CONFIG from "../utils/config";
import { getSystemPrompt } from "../utils/prompts";
import { CodeReviewSchema } from "../utils/schema";
import { Message, ReviewRequest, ReviewResult, ValidationOutcome } from "../utils/types";

// Validation function to check if the model's response is valid JSON and matches the schema.
function validateResponse(rawResponse: string): ValidationOutcome {
    // Validation layer 1 — is it valid JSON syntax?
    let parsed: unknown;
    try {
        parsed = JSON.parse(rawResponse);
    } catch (error) {
        return {
            ok: false,
            feedback: `Your previous response was NOT valid JSON (${(error as Error).message}). Do not wrap the JSON in markdown code fences and do not add any text around it.`,
        };
    }

    // Validation layer 2 — does it match the schema? (safeParse never throws)
    const result = CodeReviewSchema.safeParse(parsed);
    if (!result.success) {
        const issues = result.error.issues
            .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("\n");
        return {
            ok: false,
            feedback: `Your previous response was valid JSON but does not match the required schema. Fix these problems:\n${issues}`,
        };
    }

    return { ok: true, data: result.data };
}

const chatService = {
    async generateStructuredOutput({ code, mode = "prompt" }: ReviewRequest): Promise<ReviewResult> {
        // Start the timer for total latency measurement
        const startedAt = Date.now();

        // Retry state — tokens accumulate across ALL attempts
        let retries = 0;
        let inputTokens = 0;
        let outputTokens = 0;

        // Initialize the conversation with the system prompt and user code
        let messages: Message[] = [
            { role: "system", content: getSystemPrompt(mode) },
            { role: "user", content: `Review this code:\n\n${code}` },
        ];

        // Keep retrying until we either succeed or exhaust the retry limit
        while (true) {
            // 1. Buffered API call — no streaming (partial JSON is unparseable)
            const response = await groqClient.chat.completions.create({
                model: CONFIG.MODEL,
                messages,
                max_tokens: CONFIG.MAX_TOKENS,
                temperature: CONFIG.TEMPERATURE,
                top_p: CONFIG.TOP_P,
            });

            inputTokens += response.usage?.prompt_tokens ?? 0;
            outputTokens += response.usage?.completion_tokens ?? 0;

            const rawAssistantResponse = response.choices[0]?.message?.content ?? "";

            // 2. Validate the model's response
            const outcome = validateResponse(rawAssistantResponse);
            if (outcome.ok) {
                // 3. Return the structured review and stats
                return {
                    review: outcome.data,
                    stats: {
                        approach: mode,
                        retries,
                        inputTokens,
                        outputTokens,
                        totalLatencyMs: Date.now() - startedAt,
                    },
                };
            }

            // 4. Retries exhausted → fail loudly (for critical pipelines, bad data is worse than no data)
            if (retries >= CONFIG.MAX_RETRIES) {
                throw new Error(
                    `Structured output failed validation after ${retries + 1} attempts (approach: ${mode}). Last feedback: ${outcome.feedback}`
                );
            }

            // 5. Retry-with-correction: send the model its own bad output plus the readable error, so it can fix it on the next attempt.
            retries++;
            console.warn(`[RETRY ${retries}/${CONFIG.MAX_RETRIES}] validation failed — re-sending with correction…`);
            messages = [
                ...messages,
                { role: "assistant", content: rawAssistantResponse },
                { role: "user", content: `${outcome.feedback}\nReturn ONLY the corrected JSON object — no other text.` },
            ];
        }
    },
};

export default chatService;
