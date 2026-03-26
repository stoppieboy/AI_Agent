// src/rag/ingest.ts
import fs from 'fs';
import path from 'path';
import * as lancedb from '@lancedb/lancedb';
import * as arrow from 'apache-arrow';
import { randomUUID } from 'node:crypto';
import { openaiClient, EMBEDDING_MODEL } from '../lib/openai.js';
import { invalidateTableCache } from './retriever.js';

const DATA_DIR = './docs';
const EMBED_BATCH = 50;

export async function ingest() {
  console.log('starting ingestion...')
  // 0) Determine the embedding dimension at runtime
  const probe = await openaiClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input: 'dimension probe',
  });
  const dims = probe.data[0]?.embedding.length;
  if (!dims) throw new Error('Could not determine embedding dimensions — check that the embedding model is running.');

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
  const dirents = await fs.promises.readdir(DATA_DIR, { withFileTypes: true });
  const files = dirents
    .filter((f) => f.isFile())
    .map((f) => f.name)
    .filter((f) => /\.(md|txt|pdf|csv|log|json)$/i.test(f));

  // Purge chunks for files that no longer exist on disk
  const existingFiles = new Set(files);
  const allRows: Array<{ file: string }> = await table.query().select(['file']).toArray();
  const orphanedFiles = [...new Set(allRows.map((r) => r.file))].filter(
    (f) => f && !existingFiles.has(f),
  );
  for (const orphan of orphanedFiles) {
    console.log(`[ingest] Removing chunks for deleted file: "${orphan}"`);
    await deleteChunksByFile(table, orphan);
  }

  for (const file of files) {
    try {
      // Deduplicate: remove any previously ingested chunks for this file
      await deleteChunksByFile(table, file);

      const content = await fs.promises.readFile(path.join(DATA_DIR, file), 'utf8');
      const chunks = chunkText(content, 1200, 200).filter((c) => c.trim().length > 0);

      // Batch embed all chunks to reduce round-trips
      const rows: Array<{ id: string; text: string; vector: number[]; file: string; chunk: number }> = [];
      for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
        const batch = chunks.slice(i, i + EMBED_BATCH) as string[];
        const emb = await openaiClient.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batch,
        });
        for (let j = 0; j < batch.length; j++) {
          const vector = emb.data[j]?.embedding.map((x) => x as number);
          if (!vector) continue;
          rows.push({ id: randomUUID(), text: batch[j]!, vector, file, chunk: i + j });
        }
      }
      if (rows.length > 0) await table.add(rows);
    } catch (err) {
      console.error(`[ingest] Skipping "${file}" due to error:`, err);
    }
  }

  console.log('Ingest complete');
  invalidateTableCache();
}

function assertSafeFilename(filename: string): void {
  if (!filename || filename.includes('..') || /[/\\'"`;\t\r\n]/.test(filename)) {
    throw new Error(`[ingest] Unsafe filename rejected: "${filename}"`);
  }
}

async function deleteChunksByFile(table: any, filename: string): Promise<number> {
  assertSafeFilename(filename);
  const before = await table.countRows();
  await table.delete(`file = '${filename.replace(/'/g, "''")}'`);
  const after = await table.countRows();
  console.log('after deleteChunksByFile', { filename, before, after });
  return before - after;
}

/** Remove all RAG chunks for a specific document filename. */
export async function forgetDocument(filename: string): Promise<number> {
  const db = await lancedb.connect('./data/lancedb');
  const table = await db.openTable('chunks');
  const removed = await deleteChunksByFile(table, filename);
  invalidateTableCache();
  return removed;
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

// If you want to run directly: `npx ts-node --esm src/rag/ingest.ts`
if (process.argv[1]?.endsWith('ingest.ts') || process.argv[1]?.endsWith('ingest.js')) {
  ingest().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

