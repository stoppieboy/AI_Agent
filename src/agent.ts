// src/agent.ts
import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';
import { openaiClient, MODEL } from './lib/openai.js';
import { MAX_CONTENT_CHARS } from './lib/constants.js';
import { run_get_time, get_time } from './tools/time.js';
import { run_read_file, read_file, create_file, run_create_file } from './tools/filesystem.js';
import { recallAll } from './memory/longterm.js';
import { retrieveSimilar } from './rag/retriever.js';
import { remove_from_memory, removeFromMemory, save_to_memory, saveToMemory } from './tools/memory.js';
import { forget_document, run_forget_document, ingest_documents, run_ingest_documents } from './tools/rag.js';
import {promises as fs} from 'fs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Msg = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  name?: string;            // for tool messages
  tool_call_id?: string;    // for tool messages
};

let _systemPrompt: string | null = null;
async function getSystemPrompt(): Promise<string> {
  if (_systemPrompt === null) {
    _systemPrompt = await fs.readFile(
      path.join(PROJECT_ROOT, '.internals/prompts/system_prompt.txt'),
      'utf-8',
    );
  }
  return _systemPrompt;
}

const TOOLS = [
  get_time,
  read_file,
  save_to_memory,
  remove_from_memory,
  create_file,
  forget_document,
  ingest_documents,
];

const MAX_TOOL_ROUNDS = 8;

const toolHandlers: Record<string, (args: any) => Promise<string>> = {
  get_time: () => run_get_time(),
  read_file: (a) => run_read_file(a),
  save_to_memory: (a) => saveToMemory(a.key, a.value),
  remove_from_memory: (a) => removeFromMemory(a.key),
  create_file: (a) => run_create_file(a),
  forget_document: (a) => run_forget_document(a),
  ingest_documents: () => run_ingest_documents(),
};

async function buildContextMsg(query: string, memoryEntries: string): Promise<Msg | null> {
  let ragContext = '';
  try {
    const top = await retrieveSimilar(query, 5);
    if (top?.length) ragContext = top.join('\n---\n');
  } catch {
    console.error('RAG retrieval failed, continuing without context.');
  }
  const parts: string[] = [];
  if (memoryEntries) parts.push(`<memory>\n${memoryEntries}\n</memory>`);
  if (ragContext) parts.push(`<knowledge>\n${ragContext}\n</knowledge>`);
  if (parts.length === 0) return null;
  return { role: 'system', content: `Context for this conversation:\n${parts.join('\n\n')}` };
}

export type AgentEvent = { type: 'tool'; name: string } | { type: 'token'; content: string };

export async function runAgentTurn(
  userInput: string,
  history: Msg[] = [],
  onEvent?: (event: AgentEvent) => void,
): Promise<string> {
  const SYSTEM: Msg = { role: 'system', content: await getSystemPrompt() };
  const memoryEntries = (recallAll() as { key: string; value: string }[])
    .map((m) => `  - ${m.key}: ${m.value}`)
    .join('\n');

  const messages: Msg[] = [SYSTEM];
  const ctxMsg = await buildContextMsg(userInput, memoryEntries);
  if (ctxMsg) messages.push(ctxMsg);

  console.log(`[Agent] Context: ${messages.map(m => m.content)}`);

  // Append prior conversation turns, then the new user message
  messages.push(...history, { role: 'user', content: userInput });

  // Agentic loop: keep calling tools until the model returns a plain text answer
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    console.log(`[agent] round ${round + 1}, messages: ${messages.length}`);

    const response = await openaiClient.chat.completions.create({
      model: MODEL,
      messages: messages as any,
      tools: TOOLS as any,
      temperature: 0.3,
    });

    const assistantMsg = response.choices[0]?.message;
    if (!assistantMsg) break;

    const toolCalls = assistantMsg.tool_calls ?? [];

    // No tool calls → final answer
    if (toolCalls.length === 0) {
      console.log('[agent] Final answer produced.');
      const content = assistantMsg.content ?? '';
      if (onEvent) {
        for (const chunk of (content.match(/\S+\s*/g) ?? [content])) {
          onEvent({ type: 'token', content: chunk });
        }
      }
      return content;
    }

    console.log(`[agent] Tool calls requested: ${toolCalls.map(c => (c as any).function?.name).join(', ')}`);

    // Push the assistant's tool-call turn so the model sees its own request
    messages.push(assistantMsg as any);

    // Execute each requested tool
    for (const call of toolCalls) {
      if (call.type !== 'function' || !call.function) continue;

      const name = call.function.name;
      const args = safeParse(call.function.arguments || '{}');
      console.log(`[agent] Running tool "${name}" with args:`, args);
      onEvent?.({ type: 'tool', name });

      let result = '';
      const handler = toolHandlers[name];
      result = handler ? await handler(args) : `Unknown tool: ${name}`;

      messages.push({
        role: 'tool',
        name,
        tool_call_id: call.id,
        content: result.slice(0, MAX_CONTENT_CHARS),
      });

      // After ingestion, refresh the RAG context message in-place
      if (name === 'ingest_documents') {
        const fresh = await buildContextMsg(userInput, memoryEntries);
        const ctxIdx = messages.findIndex(
          (m) => m.role === 'system' && m.content?.startsWith('Context for this conversation:'),
        );
        if (fresh) {
          if (ctxIdx !== -1) messages[ctxIdx] = fresh;
          else messages.splice(1, 0, fresh);
        } else if (ctxIdx !== -1) {
          messages.splice(ctxIdx, 1);
        }
      }
    }
  }

  console.warn('[agent] Reached maximum tool rounds without a final answer.');
  return 'I was unable to produce a final answer within the allowed steps. Please try rephrasing your request.';
}

function safeParse(json: string) {
  try {
    return JSON.parse(json);
  } catch (err) {
    console.error('[agent] Failed to parse tool arguments:', err, '| Raw:', json);
    return {};
  }
}