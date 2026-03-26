// src/server.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { runAgentTurn, type AgentEvent } from './agent.js';
import { openaiClient, MODEL } from './lib/openai.js';
import { ingest, forgetDocument } from './rag/ingest.js';
import { closeDb } from './memory/longterm.js';

const app = express();

// Warn at startup for any env vars using defaults
(['LMSTUDIO_BASE_URL', 'LMSTUDIO_API_KEY', 'MODEL_ID', 'EMBEDDING_MODEL', 'ALLOWED_ORIGINS'] as const)
  .forEach((key) => { if (!process.env[key]) console.warn(`[config] ${key} not set, using default.`); });

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];
const MAX_HISTORY = 50;
const VALID_ROLES = new Set(['user', 'assistant', 'system', 'tool']);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '100kb' }));
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));

function validateMessages(raw: unknown): { role: string; content: string }[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const valid = raw.filter(
    (m): m is { role: string; content: string } =>
      m != null &&
      typeof m === 'object' &&
      VALID_ROLES.has((m as any).role) &&
      typeof (m as any).content === 'string',
  );
  return valid.length > 0 ? valid : null;
}

// ---- Non-streaming chat (simple) ----
app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body as { messages?: unknown };
    const validMessages = validateMessages(messages);
    if (!validMessages) {
      res.status(400).json({ error: 'messages must be a non-empty array of valid message objects' });
      return;
    }
    const r = await openaiClient.chat.completions.create({
      model: MODEL,
      messages: validMessages as any,
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

  const { messages } = req.body as { messages?: unknown };
  const validMessages = validateMessages(messages);
  if (!validMessages) {
    res.write(`data: ${JSON.stringify({ error: 'messages must be a non-empty array of valid message objects' })}\n\n`);
    res.end();
    return;
  }

  try {
    const stream = await openaiClient.chat.completions.create({
      model: MODEL,
      messages: validMessages as any,
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
// Body: { userInput: string, history?: Array<{role, content}> }
app.post('/agent', async (req, res) => {  try {
    const { userInput, history } = req.body as { userInput?: unknown; history?: unknown };
    if (typeof userInput !== 'string' || !userInput.trim()) {
      res.status(400).json({ error: 'userInput must be a non-empty string' });
      return;
    }
    const sanitizedHistory = Array.isArray(history)
      ? history
          .slice(-MAX_HISTORY)
          .filter(
            (m): m is { role: string; content: string } =>
              m != null &&
              typeof m === 'object' &&
              VALID_ROLES.has((m as any).role) &&
              typeof (m as any).content === 'string',
          )
      : [];
    console.log(`[Agent History]`, sanitizedHistory);
    const answer = await runAgentTurn(userInput, sanitizedHistory as any);
    res.json({ answer });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'agent_error' });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ---- Streaming agent turn (SSE) ----
// Body: { userInput: string, history?: Array<{role, content}> }
// Events: { type:'tool', name } | { type:'token', content } | { type:'done' } | { type:'error', message }
app.post('/agent/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders?.();

  const send = (data: AgentEvent | { type: 'done' } | { type: 'error'; message: string }) =>
    res.write(`data: ${JSON.stringify(data)}\n\n`);

  const { userInput, history } = req.body as { userInput?: unknown; history?: unknown };
  if (typeof userInput !== 'string' || !userInput.trim()) {
    send({ type: 'error', message: 'userInput must be a non-empty string' });
    res.end();
    return;
  }
  const sanitizedHistory = Array.isArray(history)
    ? history
        .slice(-MAX_HISTORY)
        .filter(
          (m): m is { role: string; content: string } =>
            m != null &&
            typeof m === 'object' &&
            VALID_ROLES.has((m as any).role) &&
            typeof (m as any).content === 'string',
        )
    : [];
  try {
    await runAgentTurn(userInput, sanitizedHistory as any, send);
    send({ type: 'done' });
    res.end();
  } catch (err: any) {
    console.error(err);
    send({ type: 'error', message: err?.message || 'agent_stream_error' });
    res.end();
  }
});

app.post('/ingest', async (_req, res) => {
  try {
    await ingest();
    res.json({ status: 'Ingestion complete' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'ingest_error' });
  }
});

// ---- Forget a document from RAG ----
app.delete('/ingest/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    if (!filename || /[\/\\]/.test(filename)) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }
    const removed = await forgetDocument(filename);
    res.json({ filename, removed });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'forget_error' });
  }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`[server] Listening on http://localhost:${PORT}`));

function shutdown(signal: string) {
  console.log(`[server] ${signal} received, shutting down gracefully...`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
``