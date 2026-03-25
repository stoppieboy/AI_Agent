import 'dotenv/config';
import OpenAI from 'openai';

export const openaiClient = new OpenAI({
  baseURL: process.env.LMSTUDIO_BASE_URL || 'http://127.0.0.1:1234/v1',
  apiKey: process.env.LMSTUDIO_API_KEY || 'lm-studio',
});

export const MODEL = process.env.MODEL_ID || 'qwen2.5-3b-instruct';
export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || 'text-embedding-nomic-embed-text-v1.5';
