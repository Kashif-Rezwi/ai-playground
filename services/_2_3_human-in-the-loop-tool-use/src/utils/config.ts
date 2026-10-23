import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// __dirname is not available in ESM — reconstruct it from import.meta.url
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../../.env') });

const CONFIG = {
  LLM_API_KEY: process.env.LLM_API_KEY || '',
  MODEL: 'openai/gpt-oss-20b',
  MAX_TOKENS: 6000,
  TEMPERATURE: 0.2,
  TOP_P: 1,

  // Tool Configuration
  TOOL_CHOICE: 'auto' as 'auto' | 'required' | 'none',
  MAX_TOOL_ITERATIONS: 5,

  // Tool-call generation retry configuration. Tool execution is never retried here.
  MAX_TOOL_CALL_RETRIES: 3,
  TEMPERATURE_RETRY_STEP: 0.2,
  MIN_TEMPERATURE: 0.2,

  // Approval TTL: how long a pending approval remains valid (5 minutes)
  APPROVAL_TTL_MS: 5 * 60 * 1000,
};

export default CONFIG;
