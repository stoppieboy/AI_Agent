// src/server.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { runAgentTurn } from './agent.js';

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  baseURL: process.env.LMSTUDIO_BASE_URL || 'http://127.0.0.1:1234/v1',
  apiKey: process.env.LMSTUDIO_API_KEY || 'lm-studio',
});

const MODEL = process.env.MODEL_ID || 'qwen2.5-3b-instruct';

// ---- Non-streaming chat (simple) ----
app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body; // [{role, content}, ...]
    const r = await client.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.7,
    });
    res.json({ answer: r.choices[0]?.message?.content ?? '' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'chat_error' });
  }
});

// ---- Streaming chat (SSE) ----
app.post('/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders?.();

  const { messages } = req.body;

  try {
    const stream = await client.chat.completions.create({
      model: MODEL,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ error: err?.message || 'stream_error' })}\n\n`);
    res.end();
  }
});

// ---- Agent turn (with tools + optional RAG) ----
app.post('/agent', async (req, res) => {
  try {
    const { userInput } = req.body;
    const answer = await runAgentTurn(userInput);
    res.json({ answer });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'agent_error' });
  }
});

app.get('/ingest', async (req, res) => {
  try {
    // Trigger the RAG ingestion process
    const { ingest } = await import('./rag/ingest.js');
    await ingest();
    res.json({ status: 'Ingestion complete' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'ingest_error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Assistant running on http://localhost:${PORT}`));
``