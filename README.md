<div align="center">

# ✦ AI Assistant

**A self-hosted AI agent with RAG, long-term memory, tool use, and a streaming chat UI — powered by any OpenAI-compatible local model.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![LanceDB](https://img.shields.io/badge/LanceDB-vector%20store-CF6679)](https://lancedb.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue)](LICENSE)

![screenshot placeholder](https://placehold.co/900x500/0f1117/6366f1?text=AI+Assistant+UI&font=inter)

</div>

---

## ✨ Features

| | Feature |
|---|---|
| 🧠 | **Agentic loop** — multi-round tool use with automatic context refresh |
| 📚 | **RAG** — ingest Markdown, text, CSV, JSON, PDF, and log files into a LanceDB vector store |
| 💾 | **Long-term memory** — SQLite-backed key-value memory the agent can read and write |
| 🛠️ | **Built-in tools** — `get_time`, `read_file`, `create_file`, `save_to_memory`, `remove_from_memory`, `ingest_documents`, `forget_document` |
| ⚡ | **Streaming** — SSE streaming on both `/agent/stream` and `/chat/stream` endpoints |
| 🖥️ | **Web UI** — single-file HTML client with dark/light themes, tool-use pills, and Markdown rendering |
| 🔒 | **Security** — rate limiting, request body size cap, input validation, path traversal protection |
| 🔌 | **Model-agnostic** — works with LM Studio, Ollama, or any OpenAI-compatible API |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│           client/index.html         │  ← single-file web UI (dark/light, SSE streaming)
└──────────────────┬──────────────────┘
                   │  HTTP / SSE
┌──────────────────▼──────────────────┐
│           src/server.ts             │  ← Express 5 API server
│  POST /agent/stream  (SSE)          │
│  POST /agent                        │
│  POST /chat/stream   (SSE)          │
│  POST /chat                         │
│  POST /ingest                       │
│  DELETE /ingest/:filename           │
│  GET  /health                       │
└──────┬───────────────────┬──────────┘
       │                   │
┌──────▼──────┐    ┌───────▼────────┐
│  src/agent  │    │  src/rag/      │
│  .ts        │    │  ingest.ts     │
│  agent loop │    │  retriever.ts  │
└──────┬──────┘    └───────┬────────┘
       │                   │
┌──────▼──────┐    ┌───────▼────────┐
│  SQLite     │    │  LanceDB       │
│  memory.db  │    │  vector store  │
└─────────────┘    └────────────────┘
       │
┌──────▼──────────────────────────────┐
│  OpenAI-compatible API              │
│  (LM Studio · Ollama · OpenAI)      │
└─────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+**
- An **OpenAI-compatible model server** running locally — [LM Studio](https://lmstudio.ai/) is recommended

### 1. Clone & install

```bash
git clone https://github.com/your-username/AI_Assistant.git
cd AI_Assistant
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
LMSTUDIO_BASE_URL=http://127.0.0.1:1234/v1
MODEL_ID=qwen2.5-3b-instruct
EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5
```

> **Tip:** In LM Studio, load a chat model and an embedding model, then start the local server on port `1234`.

### 3. Add documents *(optional)*

Drop any `.md`, `.txt`, `.csv`, `.json`, `.log`, or `.pdf` files into the `docs/` folder.

### 4. Run

```bash
# Development (hot reload)
npm run dev

# Production
npm run build && npm start
```

Open **http://localhost:3000** — the web UI loads automatically.

---

## 🖥️ Web UI

The client (`client/index.html`) is a zero-dependency single-file UI served by the Express server.

- **Agent mode** — full tool use, memory, and RAG retrieval with live streaming  
- **Chat mode** — direct streaming conversation with the model  
- **Tool pills** — animated indicators show which tool is running in real time  
- **Markdown** — rich rendering with syntax-highlighted code blocks and copy buttons  
- **Dark / Light theme** — toggled from the sidebar, persisted in `localStorage`  
- **Mobile-friendly** — collapsible sidebar with overlay  

---

## 🛠️ API Reference

All endpoints accept and return JSON. Streaming endpoints use [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).

### `POST /agent/stream` *(recommended)*
Stream an agent turn with real-time tool and token events.

```jsonc
// Request
{ "userInput": "What files are in the workspace?", "history": [] }

// SSE events
{ "type": "tool",  "name": "read_file" }
{ "type": "token", "content": "Here are" }
{ "type": "done" }
{ "type": "error", "message": "..." }
```

### `POST /agent`
Non-streaming agent turn. Returns `{ "answer": "..." }`.

### `POST /chat/stream`
Stream a plain chat completion (no tools).

```jsonc
// Request
{ "messages": [{ "role": "user", "content": "Hello!" }] }

// SSE events
{ "token": "Hi" }
{ "done": true }
```

### `POST /ingest`
Scan `docs/` and (re-)ingest all supported files into the vector store.

### `DELETE /ingest/:filename`
Remove all vector chunks for a specific file. Returns `{ "filename": "...", "removed": 12 }`.

### `GET /health`
Returns `{ "status": "ok" }`.

---

## 📁 Project Structure

```
AI_Assistant/
├── client/
│   └── index.html          # Web UI (no build step needed)
├── docs/                   # Drop documents here for RAG ingestion
├── src/
│   ├── agent.ts            # Agentic loop & event streaming
│   ├── server.ts           # Express server & route definitions
│   ├── lib/
│   │   ├── openai.ts       # Shared OpenAI client
│   │   └── constants.ts    # Shared constants (MAX_CONTENT_CHARS, …)
│   ├── memory/
│   │   └── longterm.ts     # SQLite-backed key-value memory
│   ├── rag/
│   │   ├── ingest.ts       # Document chunking & embedding
│   │   └── retriever.ts    # Vector similarity search
│   └── tools/
│       ├── filesystem.ts   # read_file, create_file
│       ├── memory.ts       # save_to_memory, remove_from_memory
│       ├── rag.ts          # ingest_documents, forget_document
│       └── time.ts         # get_time
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 🔧 Adding a Custom Tool

1. Define the tool schema and handler in `src/tools/`:

```typescript
// src/tools/weather.ts
export const get_weather = {
  type: 'function' as const,
  function: {
    name: 'get_weather',
    description: 'Get current weather for a city',
    parameters: {
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city'],
    },
  },
};

export async function run_get_weather(args: { city: string }): Promise<string> {
  // ... fetch weather API
  return `It's sunny in ${args.city}.`;
}
```

2. Register it in `src/agent.ts`:

```typescript
import { get_weather, run_get_weather } from './tools/weather.js';

const TOOLS = [ ..., get_weather ];

const toolHandlers = { ..., get_weather: (a) => run_get_weather(a) };
```

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push and open a Pull Request

---

## 📄 License

[ISC](LICENSE)
