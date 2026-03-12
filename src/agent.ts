// src/agent.ts
import 'dotenv/config';
import OpenAI from 'openai';
import { run_get_time, get_time } from './tools/time.js';
import { run_read_file, read_file, create_file, run_create_file } from './tools/filesystem.js';
import { recallAll } from './memory/longterm.js';
import { retrieveSimilar } from './rag/retriever.js';
import { remove_from_memory, removeFromMemory, save_to_memory, saveToMemory } from './tools/memory.js';
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
];

export async function runAgentTurn(userInput: string): Promise<string> {
  const memory = (recallAll() as { key: string; value: string }[])
    .map((m) => `- ${m.key}: ${m.value}`)
    .join('\n');

  // Optional RAG: fetch top-k chunks related to the query
  let ragContext = '';
  try {
    const top = await retrieveSimilar(userInput, 5);
    if (top?.length) {
      ragContext =
        `\n\nRelevant context (use if helpful):\n---\n${top.join('\n---\n')}\n---\n`;
    }
  } catch {
    // RAG is optional; ignore errors
    console.error('RAG retrieval failed, continuing without context.');
  }

  const messages: Msg[] = [
    SYSTEM,
    {
      role: 'user',
      content:
        `Here is the user's request:\n${userInput}\n\n` +
        (memory ? `Known user memory:\n${memory}\n\n` : '') +
        ragContext,
    },
  ];

  console.log('Messages sent to model:', messages);

  // 1) Ask the model with tool definitions
  const first = await client.chat.completions.create({
    model: MODEL,
    messages: messages as any,
    tools: TOOLS as any,
    temperature: 0.2,
  });

  console.log('Model initial response:', first.choices?.[0]?.message);

  // 2) Handle tool calls (if any)
  const toolCalls = first.choices?.[0]?.message?.tool_calls || [];
  if (toolCalls.length > 0) {
    const toolResults: Msg[] = [];

    for (const call of toolCalls) {

      if(call.type !== 'function' || !call.function){
        console.log("tool not a function or missing function definition, skipping...");
        continue; // currently only support function calls
      }

      const name = call.function.name;
      const args = safeParse(call.function.arguments || '{}');
      console.log("Tool call name:", name, "args:", args);

      let result = '';
      if (name === 'get_time') result = await run_get_time();
      else if (name === 'read_file') result = await run_read_file(args);
      else if (name === 'save_to_memory') await saveToMemory(args.key, args.value);
      else if (name === 'remove_from_memory') await removeFromMemory(args.key);
      else if (name === 'create_file') result = await run_create_file(args);

      toolResults.push({
        role: 'tool',
        name,
        tool_call_id: call.id,
        content: result?.slice(0, 50_000) || '',
      });
    }

    console.log('Tool results to send back to model:', toolResults);

    // 3) Send back the tool outputs in a follow-up request to get the final answer
    const follow = await client.chat.completions.create({
      model: MODEL,
      messages: [
        ...messages,
        first.choices[0]?.message as any,
        ...toolResults,
      ] as any,
      temperature: 0.2,
    });

    console.log('Model final response after tool calls:', follow.choices?.[0]?.message);

    return follow.choices?.[0]?.message?.content ?? '';
  }

  // No tool call: return the first answer
  return first.choices?.[0]?.message?.content ?? '';
}

function safeParse(json: string) {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}