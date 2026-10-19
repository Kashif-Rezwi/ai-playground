import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const CONFIG = {
  LLM_API_KEY: process.env.LLM_API_KEY || '',
  MODEL: 'openai/gpt-oss-20b',
  MAX_TOKENS: 6000,
  TEMPERATURE: 0.2,
  TOP_P: 1,
};

export default CONFIG;
