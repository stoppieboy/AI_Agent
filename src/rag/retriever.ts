// src/rag/retriever.ts
import * as lancedb from '@lancedb/lancedb';
import { openaiClient, EMBEDDING_MODEL } from '../lib/openai.js';

let _table: any = null;

export function invalidateTableCache() {
  _table = null;
}

async function getTable() {
  if (!_table) {
    const db = await lancedb.connect('./data/lancedb');
    _table = await db.openTable('chunks');
  }
  return _table;
}

export async function retrieveSimilar(query: string, k = 5): Promise<string[]> {
  const table = await getTable();

  const qEmb = await openaiClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
  });

  const results = await table
    .vectorSearch(qEmb.data[0]?.embedding as lancedb.IntoVector)
    .limit(k)
    .toArray();
  return results.map((r: any) => r.text);
}