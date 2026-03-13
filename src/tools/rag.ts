import { forgetDocument, ingest } from '../rag/ingest.js';

export const ingest_documents = {
  type: 'function' as const,
  function: {
    name: 'ingest_documents',
    description:
      'Scan the docs folder and ingest (or re-ingest) all supported documents into the RAG knowledge base. ' +
      'Use this when the user asks to ingest, index, or load documents.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

export async function run_ingest_documents(): Promise<string> {
  await ingest();
  return 'Documents ingested successfully into the knowledge base.';
}

export const forget_document = {
  type: 'function' as const,
  function: {
    name: 'forget_document',
    description:
      'Remove all RAG knowledge chunks for a specific document from the vector database. ' +
      'Use this when the user wants the assistant to forget or stop referencing a particular document.',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The filename of the document to forget (e.g. "notes.txt"). Must be a plain filename with no path separators.',
        },
      },
      required: ['filename'],
    },
  },
};

export async function run_forget_document(args: { filename: string }): Promise<string> {
  // Validate: only allow safe filenames (no path traversal)
  if (!args.filename || /[/\\]/.test(args.filename)) {
    return `Error: invalid filename "${args.filename}". Provide a plain filename with no path separators.`;
  }
  const removed = await forgetDocument(args.filename);
  if (removed === 0) {
    return `No chunks found for "${args.filename}". It may not have been ingested.`;
  }
  return `Removed ${removed} chunk(s) for "${args.filename}" from the knowledge base.`;
}
