import { Groq, APIError } from 'groq-sdk';
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from 'groq-sdk/resources/chat/completions';
import CONFIG from '../utils/config';

if (!CONFIG.LLM_API_KEY) {
  throw new Error('LLM_API_KEY is not set in the environment variables.');
}

// Create a Groq client instance with the provided API key
const groqClient = new Groq({ apiKey: CONFIG.LLM_API_KEY });

// Helper function to extract the reason for failed generation from the API error
function getFailedGenerationReason(error: unknown): string | null {
  if (!(error instanceof APIError) || error.status !== 400) return null;

  const body = error.error as { error?: { failed_generation?: unknown } } | null;
  const failedGeneration = body?.error?.failed_generation;
  if (!failedGeneration) return null;

  return typeof failedGeneration === 'string' ? failedGeneration : JSON.stringify(failedGeneration);
}

// Function to create a chat completion with retry logic for tool call generation
async function createChatWithToolCallRetry(
  params: ChatCompletionCreateParamsNonStreaming,
  stats: { retries: number },
): Promise<ChatCompletion> {
  let temperature = params.temperature ?? CONFIG.TEMPERATURE;

  for (let attempt = 1; attempt <= CONFIG.MAX_TOOL_CALL_RETRIES; attempt += 1) {
    try {
      return await groqClient.chat.completions.create({ ...params, temperature });
    } catch (error) {
      const failedGeneration = getFailedGenerationReason(error);
      if (failedGeneration === null) throw error;

      if (attempt === CONFIG.MAX_TOOL_CALL_RETRIES) {
        throw new Error(
          `Failed to generate valid tool calls after ${attempt} attempts. Last failure: ${failedGeneration}`,
        );
      }

      temperature = Math.max(
        Number((temperature - CONFIG.TEMPERATURE_RETRY_STEP).toFixed(1)),
        CONFIG.MIN_TEMPERATURE,
      );
      stats.retries += 1;
      console.warn(
        `[RETRY ${stats.retries}/${CONFIG.MAX_TOOL_CALL_RETRIES - 1}] tool call generation failed (${failedGeneration}) - re-sending with temperature ${temperature}`,
      );
    }
  }

  throw new Error('Failed to generate valid tool calls.');
}

export default createChatWithToolCallRetry;
