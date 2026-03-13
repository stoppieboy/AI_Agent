// src/agent.ts
import 'dotenv/config';
import OpenAI from 'openai';
import { run_get_time, get_time } from './tools/time.js';
import { run_read_file, read_file, create_file, run_create_file } from './tools/filesystem.js';
import { recallAll } from './memory/longterm.js';
import { retrieveSimilar } from './rag/retriever.js';
import { remove_from_memory, removeFromMemory, save_to_memory, saveToMemory } from './tools/memory.js';
import { forget_document, run_forget_document, ingest_documents, run_ingest_documents } from './tools/rag.js';
import {promises as fs} from 'fs';

const client = new OpenAI({
  baseURL: process.env.LMSTUDIO_BASE_URL || 'http://127.0.0.1:1234/v1',
  apiKey: process.env.LMSTUDIO_API_KEY || 'lm-studio',
});

const MODEL = process.env.MODEL_ID || 'qwen2.5-3b-instruct';

type Msg = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  name?: string;            // for tool messages
  tool_call_id?: string;    // for tool messages
};

const SYSTEM: Msg = {
  role: 'system',
  content: await fs.readFile('./.internals/prompts/system_prompt.txt', 'utf-8') || ''
    // 'You are a helpful local AI assistant. If tools are available and helpful, use them. ' +
    // 'If not, respond based on your own knowledge. Do not spew out random knowledge or personal details from context or memory, give only relevant information (info asked by user) based on user request. ' +
    // 'If you used a tool, mention briefly how its result informed your answer.',
};

// const TOOLS = [
//   {
//     type: 'function',
//     function: get_time.function,
//   },
//   {
//     type: 'function',
//     function: read_file.function,
//   },
// ];
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

export async function runAgentTurn(userInput: string, history: Msg[] = []): Promise<string> {
  // Build memory context
  const memoryEntries = (recallAll() as { key: string; value: string }[])
    .map((m) => `  - ${m.key}: ${m.value}`)
    .join('\n');

  // Optional RAG: fetch top-k chunks related to the query
  let ragContext = '';
  try {
    const top = await retrieveSimilar(userInput, 5);
    if (top?.length) {
      ragContext = top.join('\n---\n');
    }
  } catch {
    console.error('RAG retrieval failed, continuing without context.');
  }

  // Inject memory and RAG as a separate context message so the user turn stays clean
  const contextParts: string[] = [];
  if (memoryEntries) contextParts.push(`<memory>\n${memoryEntries}\n</memory>`);
  if (ragContext) contextParts.push(`<knowledge>\n${ragContext}\n</knowledge>`);

  const messages: Msg[] = [SYSTEM];

  if (contextParts.length > 0) {
    messages.push({
      role: 'system',
      content: `Context for this conversation:\n${contextParts.join('\n\n')}`,
    });
  }

  // Append prior conversation turns, then the new user message
  messages.push(...history, { role: 'user', content: userInput });

  // Agentic loop: keep calling tools until the model returns a plain text answer
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    console.log(`[agent] round ${round + 1}, messages: ${messages.length}`);

    const response = await client.chat.completions.create({
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
      return assistantMsg.content ?? '';
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

      let result = '';
      if (name === 'get_time') result = await run_get_time();
      else if (name === 'read_file') result = await run_read_file(args);
      else if (name === 'save_to_memory') result = await saveToMemory(args.key, args.value);
      else if (name === 'remove_from_memory') result = await removeFromMemory(args.key);
      else if (name === 'create_file') result = await run_create_file(args);
      else if (name === 'forget_document') result = await run_forget_document(args);
      else if (name === 'ingest_documents') result = await run_ingest_documents();
      else result = `Unknown tool: ${name}`;

      messages.push({
        role: 'tool',
        name,
        tool_call_id: call.id,
        content: result.slice(0, 50_000),
      });
    }
  }

  console.warn('[agent] Reached maximum tool rounds without a final answer.');
  return 'I was unable to produce a final answer within the allowed steps. Please try rephrasing your request.';
}

function safeParse(json: string) {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}