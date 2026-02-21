# Architecture Patterns

**Domain:** RAG-powered personal workout coaching app
**Researched:** 2026-02-21
**Overall confidence:** MEDIUM-HIGH

## Executive Architecture Decision: Gemini File Search vs. Self-Managed RAG

The single most important architectural decision for this project is whether to use Gemini's built-in File Search Tool (managed RAG) or build a self-managed RAG pipeline with a vector database like ChromaDB.

**Recommendation: Gemini File Search Tool as primary RAG, with SQLite for structured workout data.**

**Rationale:**
- File Search is a fully managed RAG system built into the Gemini API (launched November 2025). It handles chunking, embedding, storage, vector indexing, and retrieval automatically.
- For a single-user personal app, the managed approach eliminates an entire class of infrastructure (vector database server, embedding pipeline, retrieval logic, chunking strategy).
- Cost is near-zero: $0.15 per million tokens for initial indexing. Storage and query-time embeddings are free. Months of conversation history is likely under 1 million tokens total.
- The tradeoff (loss of control over chunking/embedding/retrieval strategy) is acceptable for a personal coaching app. Custom RAG tuning would be premature optimization.
- Incremental updates (adding new workout feedback) are straightforward: upload new documents to the File Search Store.
- Supported file formats include TXT, JSON, PDF, DOCX -- all viable for conversation exports.

**When to reconsider:** If retrieval quality proves poor for workout-specific queries, or if the 10-store-per-project limit becomes constraining, revisit with self-managed ChromaDB. This is a reversible decision -- the backend API layer abstracts the RAG implementation from the frontend.

**Confidence:** MEDIUM -- File Search Tool is new (November 2025) and independent benchmarks are still emerging as of early 2026. The tool's chunking and retrieval strategies are opaque. However, multiple sources confirm it works well for document-grounded Q&A, which aligns with our use case.

## Recommended Architecture

```
+--------------------------------------------------+
|                   FRONTEND                        |
|               React SPA (Vite)                    |
|                                                   |
|  +------------+ +-------------+ +---------------+ |
|  | Chat       | | Today's     | | Progress      | |
|  | Interface  | | Workout     | | Charts        | |
|  +------+-----+ +------+------+ +-------+-------+ |
|         |              |                |          |
|  +------+--------------+----------------+-------+  |
|  |           API Client Layer (fetch)           |  |
|  +----------------------------------------------+  |
+-----|--------------------------------------------+
      | HTTPS (JSON)
      |
+-----|--------------------------------------------+
|     v            BACKEND                          |
|           Node.js + Express                       |
|                                                   |
|  +----------------------------------------------+ |
|  |           API Routes Layer                   | |
|  |  POST /api/chat                              | |
|  |  GET  /api/workout/today                     | |
|  |  POST /api/workout/feedback                  | |
|  |  GET  /api/workout/history                   | |
|  |  GET  /api/progress/:metric                  | |
|  |  POST /api/ingest (admin)                    | |
|  +------+---------------------------------------+ |
|         |                                         |
|  +------v---------------------------------------+ |
|  |        Coaching Service Layer                | |
|  |  - Prompt construction                       | |
|  |  - Structured output parsing (Zod)           | |
|  |  - Conversation context management           | |
|  |  - Workout plan extraction                   | |
|  +------+--------+------------------------------+ |
|         |        |                                |
|  +------v-----+  +v----------------------------+  |
|  | Gemini API  |  | SQLite Database             |  |
|  | via @google |  | (better-sqlite3)            |  |
|  | /genai SDK  |  |                             |  |
|  |             |  | - workouts (structured)     |  |
|  | - Chat      |  | - exercises (structured)    |  |
|  |   generation|  | - feedback (raw text)       |  |
|  | - File      |  | - progress_metrics          |  |
|  |   Search    |  | - conversation_log          |  |
|  |   (RAG)     |  |                             |  |
|  +------+------+  +-----------------------------+  |
|         |                                         |
|  +------v---------------------------------------+ |
|  |     Gemini File Search Store                 | |
|  |     (Managed RAG - Google hosted)            | |
|  |                                              | |
|  |  - Imported conversation history             | |
|  |  - Workout feedback documents                | |
|  |  - Training preferences & notes              | |
|  +----------------------------------------------+ |
+---------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **React SPA** | UI rendering, user input, data display. No business logic. | Backend API only (via fetch) |
| **API Routes** | HTTP handling, request validation, response formatting. Thin layer. | Coaching Service |
| **Coaching Service** | Core business logic: prompt engineering, workout parsing, RAG orchestration, feedback processing | Gemini API, SQLite |
| **Gemini API Client** | Wraps @google/genai SDK. Handles chat generation and File Search tool invocation. | Google's Gemini API servers |
| **SQLite Database** | Persistent structured storage: workout plans, exercise history, progress metrics, feedback log | Accessed by Coaching Service |
| **Gemini File Search Store** | Managed vector store for RAG retrieval. Contains imported coaching history and accumulated feedback. | Accessed via Gemini API (tool use) |

### Data Flow

**Flow 1: Chat / Get New Workout**
```
User types message (e.g., "Generate my push day workout")
  -> React sends POST /api/chat { message }
    -> Coaching Service constructs prompt with:
       - User's message
       - Recent workout context from SQLite (last 3-5 workouts)
       - System prompt with coaching persona
    -> Gemini API call with File Search tool enabled
       - Gemini retrieves relevant context from File Search Store
         (training history, preferences, injury notes, past performance)
       - Gemini generates response with structured workout + coaching text
    -> Coaching Service parses response:
       - Extracts structured workout data (exercises, sets, reps, rest)
       - Stores workout plan in SQLite
       - Stores raw exchange in conversation_log
    -> Returns to frontend: { chatResponse, workoutPlan? }
  -> React updates chat display + today's workout view
```

**Flow 2: Submit Workout Feedback**
```
User types feedback (e.g., "Squats felt heavy, only got 4 reps on last set")
  -> React sends POST /api/workout/feedback { workoutId, feedback }
    -> Coaching Service:
       1. Stores feedback in SQLite (linked to workout)
       2. Creates feedback document and uploads to File Search Store
          (so future RAG queries can retrieve this feedback)
       3. Optionally sends to Gemini for acknowledgment/adjustment
    -> Returns confirmation + any AI coaching notes
  -> React updates UI
```

**Flow 3: View Progress**
```
User navigates to progress charts
  -> React sends GET /api/progress/squat_1rm (or similar)
    -> Coaching Service queries SQLite for historical data:
       - Weight progressions over time
       - Volume trends
       - PR records
    -> Returns time-series data
  -> React renders charts (Recharts or similar)
```

**Flow 4: Initial Data Ingestion (One-Time Setup)**
```
Admin/setup process:
  1. Export Gemini conversation (via Google Takeout or browser extension)
  2. Parse conversation into chunks:
     - Split by conversation turn or topic boundary
     - Extract metadata (dates, exercise mentions, injury notes)
  3. Upload chunks to Gemini File Search Store:
     - ai.fileSearchStores.create({ config: { displayName: 'coaching-history' } })
     - For each chunk: ai.fileSearchStores.uploadToFileSearchStore(...)
  4. Optionally parse structured data (PRs, exercise history) into SQLite
     for immediate chart/history display
```

## Component Deep Dives

### Frontend (React SPA)

**Structure:** Feature-based directory organization, not type-based.

```
src/
  features/
    chat/
      ChatInterface.tsx      # Main chat view
      MessageBubble.tsx       # Individual message
      ChatInput.tsx           # Text input + send
      useChat.ts              # Chat state + API calls
    workout/
      TodaysWorkout.tsx       # Current workout display
      ExerciseCard.tsx        # Single exercise with sets/reps
      WorkoutHistory.tsx      # Past workouts list
      useWorkout.ts           # Workout state + API calls
    progress/
      ProgressDashboard.tsx   # Charts container
      MetricChart.tsx         # Individual chart
      useProgress.ts          # Progress data + API calls
  shared/
    api/
      client.ts              # Base fetch wrapper
      endpoints.ts           # API endpoint definitions
    components/
      Layout.tsx
      Navigation.tsx
    types/
      workout.ts             # Shared TypeScript types
      chat.ts
```

**Key decisions:**
- Custom hooks (useChat, useWorkout, useProgress) encapsulate API calls and state. No global state management library needed for a single-user app -- React's built-in useState/useReducer plus custom hooks are sufficient.
- TanStack Query (React Query) for server state management (caching, refetching, loading states). This is the one library that pays for itself immediately in a data-heavy app.
- Mobile-first responsive design (user will access from phone at gym).

### Backend (Node.js + Express)

**Structure:**

```
server/
  index.ts                    # Express app setup, middleware
  routes/
    chat.ts                   # POST /api/chat
    workout.ts                # GET/POST workout endpoints
    progress.ts               # GET progress endpoints
    ingest.ts                 # POST /api/ingest (admin)
  services/
    coaching.ts               # Core coaching logic
    gemini.ts                 # Gemini API wrapper
    rag.ts                    # File Search Store management
    workout-parser.ts         # Parse AI response -> structured workout
  db/
    database.ts               # SQLite connection + migrations
    queries/
      workouts.ts             # Workout CRUD queries
      exercises.ts            # Exercise history queries
      progress.ts             # Progress metric queries
      feedback.ts             # Feedback storage queries
  prompts/
    system.ts                 # System prompt for coaching persona
    workout-generation.ts     # Prompt template for workout generation
    feedback-processing.ts    # Prompt template for processing feedback
  types/
    index.ts                  # Shared TypeScript types
```

**Key decisions:**
- Express over alternatives (Fastify, Hono): Express is the most familiar, has the largest ecosystem, and for a single-user app the performance difference is irrelevant. Simplicity wins.
- better-sqlite3 over Node.js native SQLite: better-sqlite3 is battle-tested and stable. Node.js native SQLite is at stability 1.1 (active development) as of Node v25 -- usable but may have API changes. For a personal project either works, but better-sqlite3 is the safer bet today.
- Prompt templates as separate files: Prompts are the soul of the coaching experience. Keeping them in dedicated files makes iteration easy without touching business logic.

### SQLite Database Schema

```sql
-- Core workout data
CREATE TABLE workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                    -- ISO 8601 date
  type TEXT NOT NULL,                    -- 'push', 'pull', 'legs', etc.
  status TEXT DEFAULT 'planned',         -- 'planned', 'completed', 'skipped'
  ai_notes TEXT,                         -- AI coaching notes for this session
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id),
  name TEXT NOT NULL,                    -- 'Barbell Back Squat'
  order_index INTEGER NOT NULL,          -- Exercise order in workout
  sets_planned INTEGER,
  reps_planned TEXT,                     -- '8-10' or '5' (can be range)
  weight_planned REAL,                   -- In user's preferred unit
  rest_seconds INTEGER,
  sets_completed INTEGER,
  reps_completed TEXT,                   -- Actual reps per set: '10,10,8'
  weight_used REAL,
  notes TEXT,                            -- Per-exercise notes
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Feedback and conversation
CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER REFERENCES workouts(id),
  raw_text TEXT NOT NULL,                -- User's freeform feedback
  ai_response TEXT,                      -- AI's response to feedback
  synced_to_rag INTEGER DEFAULT 0,       -- Whether uploaded to File Search
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,                    -- 'user' or 'assistant'
  content TEXT NOT NULL,
  workout_id INTEGER REFERENCES workouts(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Progress tracking (materialized from exercises for fast charting)
CREATE TABLE progress_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_name TEXT NOT NULL,           -- Normalized exercise name
  date TEXT NOT NULL,
  metric_type TEXT NOT NULL,             -- 'estimated_1rm', 'volume', 'max_weight'
  value REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX idx_workouts_date ON workouts(date);
CREATE INDEX idx_exercises_workout ON exercises(workout_id);
CREATE INDEX idx_exercises_name ON exercises(name);
CREATE INDEX idx_progress_exercise_date ON progress_metrics(exercise_name, date);
CREATE INDEX idx_feedback_workout ON feedback(workout_id);
```

**Why SQLite + File Search Store (dual storage):**
- SQLite handles structured, queryable data: workout plans, exercise history, progress metrics. This data needs relational queries (joins, aggregations, time-series).
- File Search Store handles unstructured coaching context: conversation history, freeform feedback, training preferences, injury notes. This data needs semantic retrieval ("what did I say about my knee?" or "how did squats go last month?").
- Neither replaces the other. Trying to put everything in vectors loses queryability. Trying to put everything in SQL loses semantic search.

### Gemini API Integration

**SDK:** `@google/genai` (official Google GenAI JavaScript SDK)

**Two distinct API usage patterns:**

**Pattern 1: Chat with RAG (File Search)**
```typescript
// services/gemini.ts
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function chatWithCoach(
  userMessage: string,
  recentContext: string,  // Recent workouts from SQLite
  fileSearchStoreName: string
) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: buildPrompt(userMessage, recentContext),
    config: {
      tools: [{
        fileSearch: {
          fileSearchStoreNames: [fileSearchStoreName]
        }
      }],
      systemInstruction: COACHING_SYSTEM_PROMPT,
    }
  });
  return response;
}
```

**Pattern 2: Structured Workout Generation**
```typescript
// services/workout-parser.ts
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const WorkoutPlanSchema = z.object({
  type: z.string().describe('Workout type: push, pull, legs, upper, lower, full'),
  exercises: z.array(z.object({
    name: z.string().describe('Exercise name'),
    sets: z.number().describe('Number of sets'),
    reps: z.string().describe('Rep range, e.g. "8-10" or "5"'),
    weight_suggestion: z.string().describe('Weight suggestion based on history'),
    rest_seconds: z.number().describe('Rest between sets in seconds'),
    notes: z.string().optional().describe('Coaching notes for this exercise'),
  })),
  warmup: z.string().describe('Warmup instructions'),
  coaching_notes: z.string().describe('Overall session coaching notes'),
});

async function generateStructuredWorkout(
  userMessage: string,
  recentContext: string,
  fileSearchStoreName: string
) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: buildWorkoutPrompt(userMessage, recentContext),
    config: {
      tools: [{
        fileSearch: {
          fileSearchStoreNames: [fileSearchStoreName]
        }
      }],
      responseMimeType: 'application/json',
      responseJsonSchema: zodToJsonSchema(WorkoutPlanSchema),
      systemInstruction: WORKOUT_GENERATION_PROMPT,
    }
  });
  return WorkoutPlanSchema.parse(JSON.parse(response.text));
}
```

**Important note on combining File Search + Structured Output:** This combination (using both `tools.fileSearch` and `responseMimeType: 'application/json'`) needs validation during implementation. These are two distinct Gemini capabilities that may or may not compose cleanly. The fallback approach is a two-step process: (1) retrieve context via File Search in a first call, (2) generate structured workout in a second call with the retrieved context injected into the prompt. **Confidence: LOW** -- this is an implementation detail to verify early.

### RAG Pipeline: Ingestion

The ingestion pipeline handles two scenarios:

**Scenario A: Initial Bulk Import (conversation history)**

```
Exported Gemini Conversation (JSON/TXT)
  |
  v
Parse & Chunk
  - Split conversation into logical segments (by date/topic)
  - Each chunk: ~500-1000 tokens
  - Preserve metadata: date, topic indicators, user vs. AI
  |
  v
Upload to File Search Store
  - ai.fileSearchStores.uploadToFileSearchStore() for each chunk
  - Add custom metadata: { date, type: "history" }
  - Poll for completion (async operation)
  |
  v
(Optional) Extract Structured Data
  - Parse known PRs, exercise preferences, injury notes
  - Seed SQLite with historical workout data if parseable
```

**Scenario B: Incremental Updates (ongoing feedback)**

```
User submits workout feedback
  |
  v
Store in SQLite (feedback table)
  |
  v
Format as RAG document:
  - Include date, workout type, exercises performed
  - Include user's raw feedback
  - Include AI's response/adjustments
  |
  v
Upload to File Search Store
  - ai.fileSearchStores.uploadToFileSearchStore()
  - Metadata: { date, type: "feedback", workout_id }
  |
  v
Mark feedback.synced_to_rag = 1 in SQLite
```

**Chunking strategy for File Search Store:**
- Gemini File Search handles chunking automatically, but you can configure it:
  - `chunkingConfig.whiteSpaceConfig.maxTokensPerChunk: 500`
  - `chunkingConfig.whiteSpaceConfig.maxOverlapTokens: 50`
- For conversation history: chunk by conversation turn or date boundary, not arbitrary token splits. Semantic boundaries matter more than size uniformity.
- For workout feedback: each feedback session is one document (typically short enough to be a single chunk).

### RAG Pipeline: Retrieval & Generation

```
User Query
  |
  v
Coaching Service builds prompt:
  1. System instruction (coaching persona, output format)
  2. Recent context from SQLite (last 3-5 workouts, structured data)
  3. User's message
  |
  v
Gemini API call with File Search tool:
  - Gemini automatically:
    a. Embeds the query using gemini-embedding-001
    b. Searches File Search Store for relevant chunks
    c. Injects retrieved context into its generation prompt
    d. Generates response grounded in retrieved documents
  - Response includes citations (which documents were used)
  |
  v
Post-processing:
  - If structured workout requested: parse JSON, validate with Zod
  - Store workout in SQLite
  - Extract progress metrics (estimated 1RM, volume)
  - Log conversation exchange
  |
  v
Return to frontend
```

**Why hybrid context (SQLite + File Search Store):**
- SQLite provides precise, structured recent context: "Here are your last 3 workouts with exact weights and reps." This is deterministic and fast.
- File Search Store provides semantic long-term memory: training preferences, injury history, what's worked in the past, coaching style preferences. This requires semantic search, not exact lookup.
- Combining both gives the AI both precise recent data AND deep historical context.

## Patterns to Follow

### Pattern 1: API Key Proxy
**What:** All Gemini API calls go through the Express backend. The API key never touches the frontend.
**Why:** Security requirement. Exposing the API key in client-side JavaScript allows anyone to use it.
**Implementation:** Store `GEMINI_API_KEY` in server environment variable. Initialize `GoogleGenAI` server-side only.

### Pattern 2: Optimistic UI Updates
**What:** When user sends a message, immediately show it in chat. Show loading state for AI response. Don't block UI.
**Why:** Gemini API calls take 2-10 seconds. Users at the gym need responsive UI.
**Implementation:** React state updates immediately on send. TanStack Query mutation handles the async flow.

### Pattern 3: Dual Response Format
**What:** AI responses contain both conversational text AND structured data. Parse both.
**Why:** The chat interface shows the conversational coaching ("Great session! Let's bump up squat weight next time."). The workout view shows the structured plan (exercise, sets, reps, weight, rest). Same AI call, two UI representations.
**Implementation:** Use system prompt to instruct Gemini to include structured workout data within its response. Parse structured data server-side before sending to frontend.

### Pattern 4: Feedback-to-RAG Pipeline
**What:** Every piece of workout feedback gets stored in both SQLite (structured) and File Search Store (for RAG retrieval).
**Why:** This is the core value proposition. The AI needs to remember everything. RAG prevents context window degradation that happens in the current Gemini conversation.
**Implementation:** Background upload to File Search Store after storing in SQLite. Don't block the user's feedback response on RAG upload completion.

### Pattern 5: Prompt Templates as Configuration
**What:** System prompts and prompt templates stored as separate files/constants, not inline in service code.
**Why:** The coaching experience is defined by prompts. You will iterate on these constantly. They should be easy to find, read, and modify without touching business logic.
**Implementation:** `server/prompts/` directory with exported template functions.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Frontend-Direct AI Calls
**What:** Calling Gemini API from React (client-side).
**Why bad:** Exposes API key. No control over costs. No ability to add server-side logic (logging, rate limiting, caching).
**Instead:** Always proxy through Express backend.

### Anti-Pattern 2: Storing Everything in Vectors Only
**What:** Using the vector store as the only database. No structured storage.
**Why bad:** You cannot run "show me my squat weight progression over 6 months" against a vector store. Vectors are for semantic search, not for aggregation, time-series queries, or relational lookups.
**Instead:** SQLite for structured data, File Search Store for semantic context. Each does what it's good at.

### Anti-Pattern 3: Massive Context Windows Instead of RAG
**What:** Stuffing the entire conversation history into each Gemini API call's context.
**Why bad:** Gemini has large context windows (1M+ tokens), but this is expensive per call, slow, and eventually the model loses focus on what matters. Context window != memory.
**Instead:** RAG retrieves only the relevant context for each query. 10 relevant chunks beat 100,000 tokens of everything.

### Anti-Pattern 4: Synchronous RAG Ingestion
**What:** Making the user wait for File Search Store upload to complete before responding to their feedback.
**Why bad:** File Search uploads are async operations that can take seconds. The user is at the gym.
**Instead:** Store feedback in SQLite immediately, return response to user, upload to File Search Store asynchronously in the background.

### Anti-Pattern 5: Premature State Management Complexity
**What:** Adding Redux, Zustand, or MobX for a single-user app.
**Why bad:** Single user, no shared state between tabs, no complex state interactions. Over-engineering adds code without value.
**Instead:** TanStack Query for server state, React useState/useReducer for UI state. Add a state library only if pain emerges.

## Build Order (Dependencies)

The architecture has clear dependency layers. Build bottom-up:

### Phase 1: Foundation (No AI Yet)
Build order rationale: Everything depends on the backend skeleton and database.

1. **Express server skeleton** -- routes, middleware, error handling
2. **SQLite database** -- schema, migrations, connection management
3. **React app skeleton** -- routing, layout, navigation shell
4. **API client layer** -- fetch wrapper, endpoint definitions
5. **Basic workout CRUD** -- manually create/view workouts (validates full stack works)

*Validates:* Frontend-to-backend communication works. Data persistence works. Deployment pipeline works.

### Phase 2: Gemini Integration (Chat Without RAG)
Build order rationale: Get AI working before adding RAG complexity.

1. **Gemini API wrapper** -- basic chat generation, API key management
2. **System prompt / coaching persona** -- define the AI's coaching style
3. **Chat interface** -- send message, display response
4. **Structured output** -- parse AI workout responses into structured data
5. **Store AI-generated workouts** -- save parsed workouts to SQLite

*Validates:* Gemini API works. Structured output parsing works. AI generates useful workout plans.

### Phase 3: RAG Pipeline (Memory)
Build order rationale: RAG is the core value but depends on everything in Phases 1-2.

1. **Conversation export parser** -- handle Gemini conversation export format
2. **File Search Store setup** -- create store, upload initial history
3. **Integrate File Search into chat** -- add `tools.fileSearch` to API calls
4. **Feedback-to-RAG pipeline** -- new feedback uploaded incrementally
5. **Verify retrieval quality** -- test that RAG actually retrieves relevant context

*Validates:* RAG retrieval improves AI responses. Historical context is accessible. Incremental updates work.

### Phase 4: Polish & Features
Build order rationale: Progress tracking and history need workout data accumulated from Phases 2-3.

1. **Today's workout view** -- display current structured workout
2. **Workout history log** -- browse and search past workouts
3. **Progress charts** -- weight progression, volume trends, PRs
4. **Mobile responsiveness** -- optimize for phone use at gym
5. **Deployment** -- Railway or Render for hosting

*Validates:* Full user experience works. App is usable at the gym.

## Deployment Architecture

**Recommendation: Railway**

```
Railway Project
  |
  +-- Web Service (Node.js + Express)
  |     - Serves React build as static files
  |     - Handles API routes
  |     - SQLite database file in persistent volume
  |     - Environment variable: GEMINI_API_KEY
  |
  +-- Persistent Volume
        - SQLite database file
        - (Optional) Backup/export files
```

**Why Railway:**
- Simplest deploy experience: connect GitHub, deploy automatically
- Persistent volumes for SQLite (critical -- without this, SQLite data resets on redeploy)
- ~$5/month for a single-user app
- Custom domain support

**Why not Vercel/Netlify:** These are serverless platforms. SQLite requires a persistent filesystem, which serverless does not provide. You would need a separate database service, adding complexity.

**Why not Fly.io:** Viable alternative, but slightly more configuration needed. Railway's GUI is simpler for a personal project.

**Single-service architecture:** Serve the React build from Express (express.static). No need for separate frontend and backend services. One service, one deploy, one URL.

```typescript
// server/index.ts
import express from 'express';
import path from 'path';

const app = express();

// API routes
app.use('/api', apiRouter);

// Serve React build
app.use(express.static(path.join(__dirname, '../client/dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});
```

## Key Constraints and Limits

| Constraint | Value | Impact |
|-----------|-------|--------|
| File Search Stores per project | 10 | Plenty for single user. Could partition by year if needed. |
| File Search Store total storage (free tier) | 1 GB | Months of conversation + ongoing feedback should fit easily. |
| Single file upload size | 100 MB | No individual document will approach this. |
| File Search documents immutability | Cannot update, only delete + re-upload | Feedback documents are append-only anyway. Not a problem. |
| Gemini embedding model | gemini-embedding-001 (3072 dimensions) | Managed by File Search. No need to call embed_content directly. |
| Gemini generation model | gemini-2.5-flash (stable) | Best price-performance. Sufficient for coaching. |
| SQLite concurrent writes | Single writer | Single-user app. Not a concern. |

## Open Questions (Verify During Implementation)

1. **File Search + Structured Output composition:** Can you use `tools.fileSearch` and `responseMimeType: 'application/json'` in the same API call? If not, implement as two-step: retrieve then generate. **(HIGH PRIORITY -- test in Phase 2)**

2. **Gemini conversation export format:** The exact JSON structure from Google Takeout or browser extensions is not documented. Need to export an actual conversation and inspect the format. **(HIGH PRIORITY -- test before Phase 3)**

3. **File Search retrieval quality for workout data:** Will File Search retrieve relevant training history when asked "what weight did I squat last week?" vs. more semantic queries like "how have my legs been feeling?" Different query types may have different retrieval quality. **(MEDIUM PRIORITY -- validate in Phase 3)**

4. **File Search Store query latency:** How much latency does File Search add to API calls? If >3 seconds on top of generation time, consider caching strategies or pre-fetching. **(MEDIUM PRIORITY -- measure in Phase 3)**

5. **Structured output reliability:** How often does Gemini produce JSON that fails Zod validation? Need error handling and retry logic. **(LOW PRIORITY -- implement error handling in Phase 2)**

## Sources

**HIGH confidence (official documentation):**
- [Gemini API Embeddings docs](https://ai.google.dev/gemini-api/docs/embeddings) -- gemini-embedding-001 specs, embed_content API
- [Gemini API Structured Output docs](https://ai.google.dev/gemini-api/docs/structured-output) -- JSON schema support, Zod integration
- [Gemini API Models docs](https://ai.google.dev/gemini-api/docs/models) -- available models, capabilities
- [Node.js SQLite API docs](https://nodejs.org/api/sqlite.html) -- stability 1.1, active development
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) -- fastest SQLite for Node.js

**MEDIUM confidence (verified with official sources):**
- [Gemini File Search tutorial (philschmid.de)](https://www.philschmid.de/gemini-file-search-javascript) -- JavaScript code examples, API patterns
- [Google blog: File Search announcement](https://blog.google/innovation-and-ai/technology/developers-tools/file-search-gemini-api/) -- capabilities, pricing, file format support
- [Gemini Embedding blog](https://developers.googleblog.com/en/gemini-embedding-text-model-now-available-gemini-api/) -- embedding model details

**LOW confidence (WebSearch, needs validation):**
- [Gemini File Search vs homebrew RAG analysis](https://medium.com/the-low-end-disruptor/google-gemini-file-search-the-end-of-homebrew-rag-1aa1529839fd) -- tradeoff analysis, limitations
- [RAG architecture patterns 2026](https://newsletter.rakeshgohel.com/p/10-types-of-rag-architectures-and-their-use-cases-in-2026) -- RAG taxonomy
- [Node.js RAG backend patterns](https://github.com/Priom7/RAG-System-Architecture-With-NodeJS) -- Express + RAG architecture example
- [Gemini exporter tool](https://github.com/Liyue2341/gemini-exporter) -- conversation export (format TBD)
- [Incremental RAG updates](https://particula.tech/blog/update-rag-knowledge-without-rebuilding) -- append-only strategies
