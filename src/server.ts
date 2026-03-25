// src/server.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runAgentTurn } from './agent.js';
import { openaiClient, MODEL } from './lib/openai.js';

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const MAX_HISTORY = 50;
const VALID_ROLES = new Set(['user', 'assistant', 'system', 'tool']);
// ---- Non-streaming chat (simple) ----
app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body as { messages?: unknown };
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages must be a non-empty array' });
      return;
    }
    const r = await openaiClient.chat.completions.create({
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

  const { messages } = req.body as { messages?: unknown };
  if (!Array.isArray(messages) || messages.length === 0) {
    res.write(`data: ${JSON.stringify({ error: 'messages must be a non-empty array' })}\n\n`);
    res.end();
    return;
  }

  try {
    const stream = await openaiClient.chat.completions.create({
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
// Body: { userInput: string, history?: Array<{role, content}> }
app.post('/agent', async (req, res) => {
  try {
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

// ---- Forget a document from RAG ----
app.delete('/ingest/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    if (!filename || /[\/\\]/.test(filename)) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }
    const { forgetDocument } = await import('./rag/ingest.js');
    const removed = await forgetDocument(filename);
    res.json({ filename, removed });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'forget_error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Assistant running on http://localhost:${PORT}`));
``