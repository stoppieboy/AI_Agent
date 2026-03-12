// src/rag/retriever.ts
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import OpenAI from 'openai';

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-nomic-embed-text-v1.5';

const client = new OpenAI({
  baseURL: process.env.LMSTUDIO_BASE_URL || 'http://127.0.0.1:1234/v1',
  apiKey: process.env.LMSTUDIO_API_KEY || 'lm-studio',
});

export async function retrieveSimilar(query: string, k = 5): Promise<string[]> {
  const db = await lancedb.connect('./data/lancedb');
  const table = await db.openTable('chunks');

  const qEmb = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
  });

  const results = await table.vectorSearch(qEmb.data[0]?.embedding as lancedb.IntoVector).limit(k).toArray();
  return results.map((r: any) => r.text);
}