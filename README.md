# Gymini Training

AI-powered strength and conditioning coach. Chat with an AI that knows your training history, generates structured workout plans, validates weights against your known maxes, tracks nutrition with macro goals, and adapts to your injuries and equipment.

Built with Hono + React 19 + SQLite + Google Gemini. Optional ChromaDB integration for RAG-based training memory, Deepgram for voice messaging, and USDA/Open Food Facts for nutrition data.

## Features

- **AI Chat Coaching** — Streaming SSE chat with Gemini 2.5 Flash, full conversation history, RAG-augmented context from past sessions
- **Structured Workout Generation** — AI generates workouts as structured JSON (program name, exercises, sets, reps, weight, rest times) and saves them to the database
- **Workout Tracking** — Log actual reps/weight per set, auto-advance through exercises, rest timer with wake lock
- **Freeform Logging** — Describe a workout in natural language and Gemini parses it into structured data
- **Weight Guardrails** — Validates AI-suggested weights against your known maxes to prevent unsafe recommendations
- **Nutrition Tracking** — Search foods via USDA FoodData Central and Open Food Facts, barcode scanning, daily macro totals with ring visualizations, customizable macro goals, automatic favorites tracking
- **Voice Messaging** — Hold-to-record voice input transcribed by Deepgram Nova-3
- **Coaching Profile** — Store biometrics, maxes, injuries, equipment, dietary constraints, and training preferences
- **RAG Memory** — ChromaDB vector store with Gemini embeddings (768-dim MRL-reduced) indexes every conversation for long-term context
- **Themes** — Atelier (light) and Midnight (dark), persisted to localStorage, respects system preference
- **Optional Basic Auth** — Protect the app with HTTP Basic Auth via environment variables
- **Mobile-First** — Four-tab layout (Chat, Workout, Nutrition, Profile), splash screen, wake lock during workouts

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Hono (Node.js), TypeScript |
| Client | React 19, Vite 7 |
| Database | SQLite via better-sqlite3, Drizzle ORM |
| AI | Google Gemini 2.5 Flash (`@google/genai`) |
| Voice | Deepgram Nova-3 (`@deepgram/sdk`) |
| Nutrition | USDA FoodData Central API, Open Food Facts API |
| Vector DB | ChromaDB with custom Gemini embedding function |
| Validation | Zod (API input + AI structured output schemas) |
| Deployment | Docker, Docker Compose, Coolify-ready |

## Project Structure

```
src/
├── client/
│   ├── components/
│   │   ├── Chat.tsx              # Streaming AI chat with SSE
│   │   ├── WorkoutView.tsx       # Workout execution (sets, reps, rest timer)
│   │   ├── NutritionPage.tsx     # Daily food log with macro rings
│   │   ├── AddFoodModal.tsx      # Food search + barcode scan + portion picker
│   │   ├── MacroRings.tsx        # SVG ring progress (cal/protein/carbs/fat)
│   │   ├── ProfileEditor.tsx     # Coaching profile form
│   │   ├── RestTimer.tsx         # Countdown overlay with audio
│   │   ├── SetRow.tsx            # Individual set input row
│   │   └── ChatSkeleton.tsx      # Loading skeleton for chat history
│   ├── hooks/
│   │   ├── useChat.ts            # Chat state + SSE streaming
│   │   ├── useNutrition.ts       # Food log CRUD + totals + goals
│   │   ├── useFoodSearch.ts      # Debounced food search + barcode
│   │   ├── useVoiceInput.ts      # MediaRecorder + Deepgram transcription
│   │   ├── useRestTimer.ts       # Countdown timer logic
│   │   └── useWakeLock.ts        # Screen Wake Lock API
│   ├── styles/global.css         # Atelier + Midnight themes
│   ├── App.tsx                   # Tab shell (chat/workout/nutrition/profile)
│   └── main.tsx                  # React entry point
├── server/
│   ├── db/
│   │   ├── index.ts              # SQLite connection (WAL mode, foreign keys)
│   │   └── schema.ts             # Drizzle schema (7 tables)
│   ├── lib/
│   │   ├── gemini.ts             # Gemini API client
│   │   ├── coaching.ts           # System prompt builder with RAG context
│   │   ├── guardrails.ts         # Weight validation against known maxes
│   │   ├── chroma.ts             # ChromaDB client + custom Gemini embeddings
│   │   ├── rag.ts                # Embed, store, and query training memory
│   │   ├── seed-chroma.ts        # Seed ChromaDB from existing workout data
│   │   ├── deepgram.ts           # Deepgram client (graceful degradation)
│   │   ├── nutrition.ts          # USDA + Open Food Facts search/barcode
│   │   └── auth.ts               # Optional Basic Auth middleware
│   ├── routes/
│   │   ├── chat.ts               # POST /send (SSE), POST /generate-workout, GET /history
│   │   ├── workouts.ts           # Workout CRUD, freeform log, PATCH sets
│   │   ├── nutrition.ts          # Food search, barcode, log CRUD, goals, favorites
│   │   ├── profile.ts            # Coaching profile GET/PUT
│   │   ├── voice.ts              # POST /transcribe (Deepgram)
│   │   ├── rag.ts                # RAG status + collection info
│   │   └── health.ts             # Health check
│   └── index.ts                  # Server entry + route mounting + static serving
└── shared/
    └── types/
        └── nutrition.ts          # Shared types (MacroData, FoodLogEntry, etc.)
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
# Terminal 1 — API server on :3000
npm run dev:server

# Terminal 2 — Vite dev server on :5173 (proxies /api to :3000)
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
| `DEEPGRAM_API_KEY` | No | — | Deepgram API key for voice messaging (Nova-3 STT) |
| `USDA_API_KEY` | No | — | USDA FoodData Central API key (falls back to Open Food Facts only) |
| `AUTH_USERNAME` | No | — | Basic Auth username (both username and password must be set to enable) |
| `AUTH_PASSWORD` | No | — | Basic Auth password |
| `PORT` | No | `3000` | Server port |
| `DB_PATH` | No | `workout.db` | Path to SQLite database file |
| `CHROMA_HOST` | No | `localhost` | ChromaDB hostname |
| `CHROMA_PORT` | No | `8000` | ChromaDB port |

### Minimum for full functionality

```env
GEMINI_API_KEY=...       # AI chat, workout generation, freeform log parsing, embeddings
DEEPGRAM_API_KEY=...     # Voice messaging
USDA_API_KEY=...         # Nutrition search (USDA + Open Food Facts; without this, only OFF)
```

### Graceful degradation

- **Without `DEEPGRAM_API_KEY`**: Voice button hidden, chat is text-only
- **Without `USDA_API_KEY`**: Nutrition search uses Open Food Facts only (no USDA results)
- **Without ChromaDB**: RAG disabled, coaching uses profile-only mode
- **Without `AUTH_USERNAME`/`AUTH_PASSWORD`**: No authentication (open access)

## Database Schema

7 tables managed by Drizzle ORM:

| Table | Purpose |
|-------|---------|
| `workouts` | Workout sessions (date, program name, notes, feedback) |
| `exercises` | Exercises within a workout (name, order, rest seconds) |
| `sets` | Set records (prescribed + actual reps/weight, RPE) |
| `messages` | Chat history (user/model, optional workout link) |
| `coaching_profiles` | Biometrics, maxes, injuries, equipment, preferences (JSON fields) |
| `nutrition_goals` | Daily macro targets (calories, protein, carbs, fat, fiber) |
| `food_log` | Food entries per day/meal with full macro breakdown |
| `favorite_foods` | Auto-tracked frequently logged foods (unique by source+sourceId) |

## API Endpoints

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |

### Chat & AI

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat/send` | Chat with AI coach (SSE stream) |
| `POST` | `/api/chat/generate-workout` | Generate structured workout plan |
| `GET` | `/api/chat/history` | Load full chat history |

### Workouts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/workouts` | List all workouts |
| `GET` | `/api/workouts/:id` | Get workout with exercises and sets |
| `POST` | `/api/workouts` | Create workout with exercises and sets |
| `POST` | `/api/workouts/:id/log` | Freeform text log (Gemini parses to structured data) |
| `PATCH` | `/api/workouts/sets/:setId` | Update actual reps/weight for a set |

### Nutrition

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/nutrition/search?q=` | Search foods (USDA + Open Food Facts) |
| `GET` | `/api/nutrition/barcode/:code` | Barcode lookup (Open Food Facts) |
| `GET` | `/api/nutrition/log?date=` | Get food log entries for a date |
| `POST` | `/api/nutrition/log` | Add food log entry (auto-upserts favorites) |
| `DELETE` | `/api/nutrition/log/:id` | Delete food log entry |
| `GET` | `/api/nutrition/totals?date=` | Aggregated daily macro totals by meal |
| `GET` | `/api/nutrition/goals` | Get macro goals |
| `PUT` | `/api/nutrition/goals` | Create or update macro goals |
| `GET` | `/api/nutrition/favorites` | Top 20 frequently used foods |

### Profile

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/profile` | Get coaching profile |
| `PUT` | `/api/profile` | Upsert coaching profile |

### Voice

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/voice/transcribe` | Speech-to-text (Deepgram Nova-3) |

### RAG

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/rag/status` | ChromaDB health + collection count |
| `GET` | `/api/rag/collection-info` | Detailed collection info with sample chunks |

## Production Deployment

### Docker

```bash
cp .env.example .env
# Edit .env with your keys

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
3. Stores the SQLite database at `/data/workout.db` (mount a volume for persistence)

### Docker Compose (with ChromaDB)

```bash
cp .env.example .env
# Edit .env with your keys

docker compose up -d
```

This starts the app and a ChromaDB instance. The app auto-seeds ChromaDB from existing workout data on startup.

### Coolify

#### Option A: Dockerfile Deploy (Recommended)

1. **Add Resource** in your Coolify project:
   - Source: **Git Repository**
   - Repository: `https://github.com/teamflow-us/workout-coach.git`
   - Branch: `main`
   - Build Pack: **Dockerfile** (auto-detected)

2. **Environment Variables** — add in the Coolify app settings:
   | Variable | Value |
   |----------|-------|
   | `GEMINI_API_KEY` | Your Gemini API key |
   | `DEEPGRAM_API_KEY` | Your Deepgram API key (optional) |
   | `USDA_API_KEY` | Your USDA API key (optional) |
   | `PORT` | `3000` |
   | `DB_PATH` | `/data/workout.db` |
   | `CHROMA_HOST` | *(see ChromaDB section below)* |
   | `CHROMA_PORT` | `8000` |

3. **Persistent Storage** — in the **Storages** tab, add a volume:
   | Source | Destination | Description |
   |--------|-------------|-------------|
   | (auto) | `/data` | SQLite database |

4. **Network** — set the container port to `3000`. Coolify handles domain and TLS.

5. **Deploy.**

#### Option B: Docker Compose Deploy

1. **Add Resource** > **Docker Compose**
2. Point to the repo — Coolify will use the `docker-compose.yml`
3. Set environment variables (`GEMINI_API_KEY`, optionally `DEEPGRAM_API_KEY`, `USDA_API_KEY`)
4. Deploy — both the app and ChromaDB start together

#### Adding ChromaDB (for Option A)

Deploy ChromaDB as a separate Coolify service:

1. **Add Resource** > **Docker Image**
   - Image: `chromadb/chroma:latest`
   - Port: `8000`
2. Add a persistent volume for `/chroma/chroma`
3. Put both services on the same Coolify network
4. Set `CHROMA_HOST` in the app's env vars to the ChromaDB service's internal hostname
5. Set `CHROMA_PORT` to `8000`

ChromaDB is optional — the app degrades gracefully without it.

#### Architecture

```
Coolify
┌─────────────────────────────────────────┐
│  workout-coach (Dockerfile)             │
│  ┌──────────┐ ┌───────────┐             │
│  │ Hono API │ │ React SPA │             │
│  │ :3000/api│ │ :3000/*   │             │
│  └────┬─────┘ └───────────┘             │
│       │                                 │
│  /data/workout.db  (SQLite volume)      │
└─────────────────────────────────────────┘
        │ optional          │ optional
   ┌────┴─────┐      ┌─────┴──────┐
   │ ChromaDB │      │  External  │
   │  :8000   │      │  Deepgram  │
   └──────────┘      │  USDA API  │
                     │  OFF API   │
                     └────────────┘
```
