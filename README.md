# Workout Coach

AI-powered strength and conditioning coach. Chat with an AI that knows your training history, generates structured workout plans, validates weights against your known maxes, and adapts to your injuries and equipment.

Built with Hono + React + SQLite + Google Gemini. Optional ChromaDB integration for RAG-based training memory.

## Tech Stack

- **Server:** Hono (Node.js), TypeScript, Drizzle ORM
- **Client:** React 19, Vite
- **Database:** SQLite (better-sqlite3)
- **AI:** Google Gemini (`@google/genai`)
- **Vector DB:** ChromaDB (optional, for RAG memory)
- **Deployment:** Docker, Coolify-ready

## Project Structure

```
src/
├── client/
│   ├── components/        # React UI (Chat, WorkoutView, ProfileEditor, etc.)
│   ├── hooks/             # useChat, useRestTimer, useWakeLock
│   ├── styles/global.css
│   ├── App.tsx
│   └── main.tsx
└── server/
    ├── db/
    │   ├── index.ts       # SQLite connection (configurable DB_PATH)
    │   └── schema.ts      # Drizzle schema
    ├── lib/
    │   ├── gemini.ts      # Gemini API client
    │   ├── coaching.ts    # System prompt builder
    │   ├── guardrails.ts  # Weight validation against known maxes
    │   ├── chroma.ts      # ChromaDB vector store
    │   └── rag.ts         # Retrieval-augmented generation
    ├── routes/
    │   ├── chat.ts        # Streaming chat (SSE)
    │   ├── workouts.ts    # Workout CRUD
    │   ├── profile.ts     # Coaching profile CRUD
    │   ├── rag.ts         # RAG endpoints
    │   └── health.ts      # Health check
    └── index.ts           # Server entry + static file serving
```

## Local Development

### Prerequisites

- Node.js 20+
- A [Google Gemini API key](https://aistudio.google.com/apikey)

### Setup

```bash
git clone https://github.com/teamflow-us/workout-coach.git
cd workout-coach
npm install
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### Create the database

```bash
npm run db:push
```

### Run (two terminals)

```bash
# Terminal 1 — API server on :3001
npm run dev:server

# Terminal 2 — Vite dev server on :5173 (proxies /api to :3001)
npm run dev:client
```

Open http://localhost:5173.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev:server` | Start server with hot-reload (tsx watch) |
| `npm run dev:client` | Start Vite dev server with HMR |
| `npm run build` | Build React client for production |
| `npm start` | Start production server (serves API + static client) |
| `npm run db:push` | Push schema changes to SQLite |
| `npm run db:generate` | Generate Drizzle migration files |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | — | Google Gemini API key |
| `PORT` | No | `3000` | Server port |
| `DB_PATH` | No | `workout.db` | Path to SQLite database file |
| `CHROMA_HOST` | No | `localhost` | ChromaDB hostname |
| `CHROMA_PORT` | No | `8100` | ChromaDB port |

## Production Deployment

### Docker

```bash
cp .env.example .env
# Edit .env with your GEMINI_API_KEY

docker build -t workout-coach .
docker run -d \
  --name workout-coach \
  -p 3000:3000 \
  -v workout-data:/data \
  --env-file .env \
  workout-coach
```

The container:
1. Runs `drizzle-kit push` on startup to create/migrate the schema
2. Starts the Node.js server which serves both the API and the React SPA
3. Stores the SQLite database at `/data/workout.db` (mount a volume here for persistence)

### Docker Compose (with ChromaDB)

```bash
cp .env.example .env
# Edit .env with your GEMINI_API_KEY

docker compose up -d
```

This starts both the app and a ChromaDB instance for RAG memory features. The app will use ChromaDB for context-aware coaching based on past training sessions.

### Coolify

#### Option A: Dockerfile Deploy (Recommended)

1. **Add Resource** in your Coolify project:
   - Source: **Git Repository** (public or private)
   - Repository: `https://github.com/teamflow-us/workout-coach.git`
   - Branch: `main`
   - Build Pack: **Dockerfile** (auto-detected)

2. **Environment Variables** — add in the Coolify app settings:
   | Variable | Value |
   |----------|-------|
   | `GEMINI_API_KEY` | Your Gemini API key |
   | `PORT` | `3000` |
   | `DB_PATH` | `/data/workout.db` |
   | `CHROMA_HOST` | *(see ChromaDB section below)* |
   | `CHROMA_PORT` | `8000` |

3. **Persistent Storage** — in the **Storages** tab, add a volume:
   | Source | Destination | Description |
   |--------|-------------|-------------|
   | (auto) | `/data` | SQLite database |

   Without this, the database resets on every deploy.

4. **Network** — set the container port to `3000`. Coolify handles domain and TLS.

5. **Deploy.**

#### Option B: Docker Compose Deploy

1. **Add Resource** > **Docker Compose**
2. Point to the repo — Coolify will use the `docker-compose.yml`
3. Set `GEMINI_API_KEY` in the environment variables
4. Deploy — both the app and ChromaDB start together

#### Adding ChromaDB (for Option A)

If you want RAG-based training memory, deploy ChromaDB as a separate Coolify service:

1. **Add Resource** > **Docker Image**
   - Image: `chromadb/chroma:0.6.3`
   - Port: `8000`
2. Add a persistent volume for `/chroma/chroma`
3. Put both services on the same Coolify network
4. Set `CHROMA_HOST` in the app's env vars to the ChromaDB service's internal hostname
5. Set `CHROMA_PORT` to `8000`

ChromaDB is optional — the app degrades gracefully without it, using profile-only coaching mode.

#### Architecture

```
Coolify
┌──────────────────────────────┐
│  workout-coach (Dockerfile)  │
│  ┌──────────┐ ┌───────────┐  │
│  │ Hono API │ │ React SPA │  │
│  │ :3000/api│ │ :3000/*   │  │
│  └────┬─────┘ └───────────┘  │
│       │                      │
│  /data/workout.db  (volume)  │
└──────────────────────────────┘
        │ optional
   ┌────┴─────┐
   │ ChromaDB │
   │  :8000   │
   └──────────┘
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/profile` | Get coaching profile |
| `PUT` | `/api/profile` | Update coaching profile |
| `GET` | `/api/workouts` | List workouts |
| `POST` | `/api/workouts` | Create workout |
| `POST` | `/api/chat` | Chat with AI coach (SSE stream) |
| `GET` | `/api/rag/stats` | RAG collection stats |
