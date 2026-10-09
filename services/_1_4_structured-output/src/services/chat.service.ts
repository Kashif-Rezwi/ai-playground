import groqClient from "./llm.service";
import CONFIG from "../utils/config";
import { CodeReviewSchema } from "../utils/schema";
import { Message, ReviewMode, ReviewRequest, ReviewResult } from "../utils/types";

// Helper function to get the system prompt based on the review mode
function getSystemPrompt(mode: ReviewMode): string {
    if (mode === "prompt") return CONFIG.SYSTEM_PROMPT;
    throw new Error(`Approach "${mode}" is not implemented yet.`);
}

// Helper function to parse JSON and throw an error if parsing fails
function parseJSONResponse(rawResponse: string): unknown {
    try {
        return JSON.parse(rawResponse);
    } catch (error) {
        throw new Error(`Model response was not valid JSON (${(error as Error).message}).`);
    }
}

const chatService = {
    async generateStructuredOutput({ code, mode = "prompt" }: ReviewRequest): Promise<ReviewResult> {
        // Start the timer for total latency measurement
        const startedAt = Date.now();

        const messages: Message[] = [
            { role: "system", content: getSystemPrompt(mode) },
            { role: "user", content: `Review this code:\n\n${code}` },
        ];

        // 1. Buffered API call — no streaming (partial JSON is unparseable)
        const response = await groqClient.chat.completions.create({
            model: CONFIG.MODEL,
            messages,
            max_tokens: CONFIG.MAX_TOKENS,
            temperature: CONFIG.TEMPERATURE,
            top_p: CONFIG.TOP_P,
        });

        const rawAssistantResponse = response.choices[0]?.message?.content ?? "";

        // 2. Validation layer 1 — is it valid JSON syntax?
        const parsed: unknown = parseJSONResponse(rawAssistantResponse);

        // 3. Validation layer 2 — does it match the schema? (safeParse never throws)
        const result = CodeReviewSchema.safeParse(parsed);
        if (!result.success) {
            const issues = result.error.issues
                .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
                .join("\n");
            throw new Error(`Model response was valid JSON but failed schema validation:\n${issues}`);
        }

        // 4. Return the structured review and stats
        return {
            review: result.data,
            stats: {
                approach: mode,
                retries: 0,
                inputTokens: response.usage?.prompt_tokens ?? 0,
                outputTokens: response.usage?.completion_tokens ?? 0,
                totalLatencyMs: Date.now() - startedAt,
            },
        };
    },
};

export default chatService;
