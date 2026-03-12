// src/rag/ingest.ts
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import * as lancedb from '@lancedb/lancedb';
import * as arrow from 'apache-arrow';

const DATA_DIR = './docs';
const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || 'text-embedding-nomic-embed-text-v1.5';

const client = new OpenAI({
  baseURL: process.env.LMSTUDIO_BASE_URL || 'http://127.0.0.1:1234/v1',
  apiKey: process.env.LMSTUDIO_API_KEY || 'lm-studio',
});

export async function ingest() {
  console.log('starting ingestion...')
  // 0) Determine the embedding dimension at runtime
  const probe = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: 'dimension probe',
  });
  const dims = probe.data[0]?.embedding.length;

  // 1) Connect to LanceDB
  const db = await lancedb.connect('./data/lancedb');

  // 2) Build an Arrow schema with a fixed-size vector field
  const schema = new arrow.Schema([
    arrow.Field.new({ name: 'id', type: new arrow.Utf8(), nullable: false }),
    arrow.Field.new({ name: 'text', type: new arrow.Utf8(), nullable: false }),
    // vector: FixedSizeList< Float32, dims >
    arrow.Field.new({
      name: 'vector',
      type: new arrow.FixedSizeList(dims || 0, new arrow.Field('item', new arrow.Float32())),
      nullable: false,
    }),
    arrow.Field.new({ name: 'file', type: new arrow.Utf8(), nullable: true }),
    arrow.Field.new({ name: 'chunk', type: new arrow.Int32(), nullable: true }),
  ]);

  // 3) Ensure table exists (idempotent)
  //    Using createEmptyTable(name, schema, { mode: "create", existOk: true })
  //    acts like CREATE TABLE IF NOT EXISTS
  let table;
  try {
    // create if missing; open if it exists
    table = await (db as any).createEmptyTable('chunks', schema, {
      mode: 'create',
      existOk: true,
    });
  } catch {
    // Some SDK versions don’t expose createEmptyTable directly on `db` typings
    // Fallback: open existing table
    table = await db.openTable('chunks');
  }

  // 4) Walk files and add chunked rows with fresh embeddings
  const files = fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((f) => f.isFile())
    .map((f) => f.name)
    .filter((f) => /\.(md|txt|pdf|csv|log|json)$/i.test(f));

  for (const file of files) {
    const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
    const chunks = chunkText(content, 1200, 200);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      const emb = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: chunk || [],
      });

      const vector = emb.data[0]?.embedding.map((x) => x as number); // Float32 later

      await table.add([
        {
          id: cryptoRandom(),
          text: chunk,
          vector,
          file,
          chunk: i,
        },
      ]);
    }
  }

  console.log('Ingest complete');
}

function chunkText(text: string, size = 1000, overlap = 100): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    out.push(text.slice(i, i + size));
    i += Math.max(1, size - overlap);
  }
  return out;
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// If you want to run directly: `npx ts-node --esm src/rag/ingest.ts`
if (process.argv[1]?.endsWith('ingest.ts')) {
  ingest().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

// ingest().catch(console.error)