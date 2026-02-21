# Phase 1: Validation and Foundation - Research

**Researched:** 2026-02-21
**Domain:** Gemini API ecosystem, ChromaDB vector store, Hono backend, SQLite/Drizzle ORM, RAG strategy
**Confidence:** MEDIUM-HIGH (most findings verified with official docs; some ChromaDB JS specifics from single sources)

## Summary

Phase 1 covers two distinct concerns: (1) pre-build validation of the Gemini conversation export, token counting, and ChromaDB embedding pipeline, and (2) standing up the full-stack skeleton with Hono, SQLite/Drizzle, and a React shell.

The standard approach uses `@google/genai` (GA, v1.42+) as the unified SDK for both Gemini generation and embeddings. ChromaDB v3 (`chromadb` npm v3.3+) runs as a separate server process with the JS client connecting over HTTP. Drizzle ORM with `better-sqlite3` provides a type-safe, migration-friendly SQLite layer. Hono on Node.js with `@hono/node-server` serves the API and static React assets.

The critical unknown is the Gemini conversation size. If the exported conversation is under ~200K tokens, context stuffing with Gemini's 1M context window is the simplest viable strategy. If larger, a hybrid approach (context stuffing + selective RAG retrieval) is warranted. Full RAG is only necessary if the corpus exceeds ~500K tokens or grows unbounded over time.

**Primary recommendation:** Export via Google Takeout + Chrome extension fallback. Measure tokens with `countTokens` API. Use context stuffing if under 200K tokens; defer full RAG pipeline to Phase 3 regardless (it adds value even with small corpora as the data grows).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | 1.42+ | Gemini API SDK (generation, embeddings, token counting) | Official Google SDK, GA since May 2025, replaces deprecated `@google/generative-ai` |
| `chromadb` | 3.3+ | Vector store JS client | Official ChromaDB JS client, v3 rewrite with smaller bundle and better TS support |
| `@chroma-core/google-gemini` | latest | ChromaDB embedding function for Gemini | Official integration package, uses `gemini-embedding-001` model |
| `hono` | 4.x | Backend API framework | Lightweight, Web Standards-based, native Node.js adapter |
| `@hono/node-server` | latest | Hono Node.js adapter | Official adapter for running Hono on Node.js |
| `drizzle-orm` | latest | TypeScript ORM for SQLite | Type-safe schema definition, SQL-like query API, lightweight |
| `better-sqlite3` | latest | SQLite driver for Node.js | Fast synchronous SQLite driver, well-established |
| `drizzle-kit` | latest (dev dep) | Schema migrations CLI | Generates and applies migrations from Drizzle schema |
| `react` | 19.x | Frontend framework | User's chosen framework |
| `zod` | 3.x | Schema validation | Integrates with Gemini structured output via `zodToJsonSchema()` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` | latest | Environment variable loading | Local development (load `.env` file) |
| `zod-to-json-schema` | latest | Convert Zod to JSON Schema | When using Gemini structured output with Zod schemas |
| `vite` | 6.x | React build tool and dev server | Frontend development and production builds |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `better-sqlite3` | `@libsql/client` | libsql supports remote databases and more ALTER statements; overkill for local-only SQLite |
| ChromaDB server | ChromaDB Cloud | Cloud removes server management; adds network dependency and cost |
| Manual copy-paste export | Chrome extension (Gemini Chat Exporter) | Extension produces structured JSON; manual paste is simpler but less structured |

**Installation:**
```bash
# Backend
npm install hono @hono/node-server @google/genai drizzle-orm better-sqlite3 zod zod-to-json-schema dotenv
npm install -D drizzle-kit @types/better-sqlite3 typescript

# ChromaDB (validation script)
npm install chromadb @chroma-core/google-gemini

# Frontend (separate or monorepo)
npm install react react-dom
npm install -D vite @vitejs/plugin-react
```

## Architecture Patterns

### Recommended Project Structure
```
william-workout/
├── src/
│   ├── server/
│   │   ├── index.ts            # Hono app entry, mounts routes
│   │   ├── routes/
│   │   │   ├── workouts.ts     # Workout CRUD routes
│   │   │   └── health.ts       # Health check route
│   │   ├── db/
│   │   │   ├── schema.ts       # Drizzle schema definitions
│   │   │   ├── index.ts        # Database connection
│   │   │   └── seed.ts         # Optional seed data
│   │   └── lib/
│   │       └── gemini.ts       # Gemini API client wrapper
│   └── client/                 # React app (built by Vite)
│       ├── index.html
│       ├── main.tsx
│       └── App.tsx
├── scripts/
│   ├── validate-export.ts      # VALID-01: Export validation
│   ├── count-tokens.ts         # VALID-01: Token counting
│   └── test-chromadb.ts        # VALID-02: ChromaDB pipeline test
├── data/
│   └── gemini-export.txt       # Exported conversation (gitignored)
├── drizzle/                    # Generated migration files
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── .env                        # GEMINI_API_KEY (gitignored)
```

### Pattern 1: Hono Route Modules
**What:** Separate route files mounted via `app.route()`
**When to use:** Always -- keeps routes organized and type-safe

```typescript
// Source: https://hono.dev/docs/guides/best-practices
// src/server/routes/workouts.ts
import { Hono } from 'hono'

const app = new Hono()

app.get('/', async (c) => {
  // list workouts
  return c.json(workouts)
})

app.post('/', async (c) => {
  // create workout
  const body = await c.req.json()
  return c.json(created, 201)
})

export default app

// src/server/index.ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import workouts from './routes/workouts'

const app = new Hono()
app.use('/api/*', cors())
app.route('/api/workouts', workouts)

serve({ fetch: app.fetch, port: 3001 })
```

### Pattern 2: Drizzle SQLite Schema
**What:** Type-safe schema definition with Drizzle ORM for SQLite
**When to use:** All database table definitions

```typescript
// Source: https://orm.drizzle.team/docs/sql-schema-declaration
// src/server/db/schema.ts
import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core'

export const workouts = sqliteTable('workouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),          // ISO date string
  programName: text('program_name'),
  notes: text('notes'),
  feedback: text('feedback'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
})

export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workoutId: integer('workout_id').notNull().references(() => workouts.id),
  name: text('name').notNull(),
  order: integer('order').notNull(),
})

export const sets = sqliteTable('sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  setNumber: integer('set_number').notNull(),
  reps: integer('reps'),
  weight: real('weight'),
  rpe: real('rpe'),
  notes: text('notes'),
})
```

### Pattern 3: Gemini Embeddings with ChromaDB
**What:** Generate embeddings via Gemini API and store in ChromaDB
**When to use:** VALID-02 validation script

```typescript
// Source: https://docs.trychroma.com/integrations/embedding-models/google-gemini
// scripts/test-chromadb.ts
import { ChromaClient } from 'chromadb'
import { GoogleGeminiEmbeddingFunction } from '@chroma-core/google-gemini'

const client = new ChromaClient({ path: 'http://localhost:8000' })

const embedder = new GoogleGeminiEmbeddingFunction({
  apiKey: process.env.GEMINI_API_KEY!,
  // Defaults to gemini-embedding-001 (3072 dimensions)
  // Can specify taskType: 'RETRIEVAL_DOCUMENT' for indexing
})

const collection = await client.getOrCreateCollection({
  name: 'coaching-history',
  embeddingFunction: embedder,
})

// Add documents -- ChromaDB handles embedding via the function
await collection.add({
  ids: ['chunk-1', 'chunk-2'],
  documents: [
    'User: Squats felt heavy today. AI: Reduce weight by 10%...',
    'User: Hit a PR on bench press. AI: Great progress...',
  ],
  metadatas: [
    { date: '2025-10-15', type: 'workout-feedback' },
    { date: '2025-10-18', type: 'workout-feedback' },
  ],
})

// Query -- returns semantically similar results
const results = await collection.query({
  queryTexts: ['What was my last squat session like?'],
  nResults: 3,
})

console.log(results.documents)
```

### Pattern 4: Gemini Token Counting
**What:** Count tokens in exported conversation data
**When to use:** VALID-01 measurement step

```typescript
// Source: https://ai.google.dev/api/tokens
// scripts/count-tokens.ts
import { GoogleGenAI } from '@google/genai'
import { readFileSync } from 'fs'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const exportText = readFileSync('./data/gemini-export.txt', 'utf-8')

const result = await ai.models.countTokens({
  model: 'gemini-2.5-flash',  // Use intended generation model
  contents: exportText,
})

console.log(`Total tokens: ${result.totalTokens}`)
// Use this number to decide RAG strategy
```

### Pattern 5: Gemini Structured Output with Zod
**What:** Get structured JSON responses from Gemini using Zod schemas
**When to use:** When parsing AI coaching responses into workout data

```typescript
// Source: https://ai.google.dev/gemini-api/docs/structured-output
import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

const workoutSchema = z.object({
  exercises: z.array(z.object({
    name: z.string(),
    sets: z.number(),
    reps: z.number(),
    weight: z.number().optional(),
    restSeconds: z.number().optional(),
  })),
  notes: z.string().optional(),
})

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Generate a push day workout...',
  config: {
    responseMimeType: 'application/json',
    responseJsonSchema: zodToJsonSchema(workoutSchema),
  },
})

const workout = workoutSchema.parse(JSON.parse(response.text!))
```

### Anti-Patterns to Avoid
- **Embedding the Gemini API key in the frontend:** The entire point of the Hono backend is to proxy Gemini calls and keep the key server-side. Never expose `GEMINI_API_KEY` to the client.
- **Running ChromaDB in-memory for anything beyond quick tests:** Data is lost on process exit. Always use `chroma run --path ./chroma-data` for persistent storage.
- **Using the deprecated `@google/generative-ai` SDK:** End-of-life was November 2025. Use `@google/genai` exclusively.
- **Hand-building SQL migrations:** Drizzle Kit generates migrations from schema diffs. Use `drizzle-kit push` for development, `drizzle-kit generate` + `drizzle-kit migrate` for production.
- **Storing dates as integers in SQLite:** Use ISO 8601 text strings (`text` column type). SQLite has no native datetime; text is most portable and readable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Custom tokenizer or character-based estimation | `ai.models.countTokens()` from `@google/genai` | Gemini tokenization is model-specific; only the API gives accurate counts |
| Embedding generation | Custom embedding logic | `@chroma-core/google-gemini` embedding function | Handles API calls, batching, and dimension configuration |
| Database migrations | Manual SQL scripts | `drizzle-kit generate` + `drizzle-kit migrate` | Schema-diff-based, tracks state, prevents drift |
| JSON response validation | Manual type checking | Zod schemas + `zodToJsonSchema()` for Gemini structured output | Compile-time AND runtime type safety, integrates with Gemini natively |
| CORS handling | Manual headers | `hono/cors` built-in middleware | Handles preflight, multiple origins, credentials correctly |
| Environment variable loading | Manual `process.env` parsing | `dotenv` + Hono's `env()` helper | Cross-runtime compatible, type-safe with Hono bindings |

**Key insight:** The Gemini SDK, ChromaDB client, and Drizzle ORM each handle complexity that looks simple but has sharp edges (tokenization differences, embedding dimension configuration, SQLite migration limitations). Trust the libraries.

## Common Pitfalls

### Pitfall 1: Google Takeout Export Is Truncated
**What goes wrong:** Google Takeout's Gemini export produces stripped-down prompt-response pairs with truncated content -- not the full conversation.
**Why it happens:** Takeout is designed for data portability compliance, not full-fidelity export. Long responses get cut off.
**How to avoid:** Use Google Takeout as the primary method but verify completeness. If truncated, fall back to a Chrome extension like "Gemini Chat Exporter" or the `gemini-exporter` CLI tool which use the web app DOM to capture full content. Manual copy-paste from the single mega-thread is the final fallback (most labor-intensive but guaranteed complete).
**Warning signs:** Responses that end mid-sentence, missing workout details that you know were discussed.

### Pitfall 2: ChromaDB Server Not Running
**What goes wrong:** The JS client throws connection errors because ChromaDB requires a separate server process.
**Why it happens:** Unlike Python's `PersistentClient` which embeds the database, the JavaScript client is HTTP-only -- it MUST connect to a running ChromaDB server.
**How to avoid:** Always start the ChromaDB server before running JS code: `npx chroma run --path ./chroma-data`. In development, use a startup script or process manager that launches both the Chroma server and the Hono backend.
**Warning signs:** `ECONNREFUSED` errors on port 8000.

### Pitfall 3: Embedding Dimension Mismatch
**What goes wrong:** Switching embedding models or dimension settings after data is already indexed causes query failures or poor results.
**Why it happens:** `gemini-embedding-001` defaults to 3072 dimensions but supports 768 and 1536. If you change this after indexing, old and new embeddings are incompatible.
**How to avoid:** Decide on dimensions upfront (768 is sufficient for this use case and reduces storage). Set it once in the embedding function config and don't change it. If you must change, re-embed all documents.
**Warning signs:** Similarity scores that make no sense, dimension mismatch errors.

### Pitfall 4: SQLite ALTER TABLE Limitations
**What goes wrong:** Drizzle Kit generates migrations that SQLite can't execute (e.g., dropping columns, changing column types).
**Why it happens:** SQLite has limited ALTER TABLE support compared to Postgres/MySQL. Complex schema changes require creating a new table, copying data, and dropping the old one.
**How to avoid:** Use `drizzle-kit push` during development (it handles this automatically). For production migrations, Drizzle Kit will warn you and suggest the copy-table approach. Design your schema carefully upfront to minimize breaking changes.
**Warning signs:** Migration errors mentioning unsupported ALTER operations.

### Pitfall 5: Gemini Context Window Pricing Tiers
**What goes wrong:** Unexpected API costs when stuffing large contexts.
**Why it happens:** Gemini Pro models charge 2x for prompts over 200K tokens. Flash models have uniform pricing but smaller output limits.
**How to avoid:** Use Gemini 2.5 Flash for development and validation (cheaper: $0.30/1M tokens input). Use context caching for repeated queries against the same coaching data (reduces cost by ~75%). Monitor token usage with `countTokens` before generation calls.
**Warning signs:** API bills higher than expected, slow response times with large contexts.

### Pitfall 6: Overcomplicating the RAG Strategy Too Early
**What goes wrong:** Building a full RAG pipeline before knowing if the data even needs it.
**Why it happens:** RAG is the project's eventual architecture, so there's temptation to build it first. But the coaching conversation might fit in a single context window.
**How to avoid:** Measure first (VALID-01), decide second (VALID-03). If the conversation is under 200K tokens, context stuffing works for Phase 2 while RAG is properly built in Phase 3.
**Warning signs:** Building embedding pipelines before knowing the token count.

## Code Examples

### Gemini API Client Initialization
```typescript
// Source: https://ai.google.dev/gemini-api/docs/libraries
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

// Generation
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Hello',
})
console.log(response.text)

// Embeddings
const embeddingResponse = await ai.models.embedContent({
  model: 'gemini-embedding-001',
  contents: 'Text to embed',
  config: { taskType: 'RETRIEVAL_DOCUMENT' },
})
console.log(embeddingResponse.embeddings)
```

### Drizzle Database Connection and Query
```typescript
// Source: https://orm.drizzle.team/docs/get-started-sqlite
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'

const sqlite = new Database('workout.db')
const db = drizzle({ client: sqlite, schema })

// Insert
await db.insert(schema.workouts).values({
  date: '2026-02-21',
  programName: 'Push Day A',
  notes: 'Feeling strong today',
})

// Query with relations
const workoutsWithExercises = await db.query.workouts.findMany({
  with: { exercises: { with: { sets: true } } },
})
```

### Drizzle Config
```typescript
// drizzle.config.ts
// Source: https://orm.drizzle.team/docs/drizzle-config-file
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: 'file:./workout.db',
  },
})
```

### Hono Server with Static React Serving
```typescript
// Source: https://hono.dev/docs/getting-started/nodejs
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// API routes with CORS
app.use('/api/*', cors())
app.route('/api/workouts', workoutRoutes)
app.route('/api/health', healthRoutes)

// Serve React build output
app.use('/*', serveStatic({ root: './dist/client' }))

// SPA fallback -- serve index.html for client-side routing
app.get('*', serveStatic({ path: './dist/client/index.html' }))

serve({ fetch: app.fetch, port: 3001 })
```

## Gemini Export Strategy

### Method Priority (try in order)

1. **Google Takeout** (preferred)
   - Go to takeout.google.com, select only "Gemini Apps"
   - Export downloads as a zip containing JSON files
   - **Risk:** Content may be truncated. Verify completeness.

2. **Chrome Extension: Gemini Chat Exporter**
   - Install from Chrome Web Store
   - Navigate to the mega-thread in Gemini, export as JSON or text
   - Captures full DOM content including complete responses

3. **gemini-exporter CLI tool** (github.com/Liyue2341/gemini-exporter)
   - Uses Playwright + AI Chat Exporter extension
   - Automated, captures full fidelity
   - More complex setup (requires Python + Chrome)

4. **Manual copy-paste** (fallback)
   - Open mega-thread, select all, paste into text file
   - Most labor intensive but guaranteed complete for a single thread
   - The conversation is one continuous thread, so this is viable

### Export Quality Validation
After export, verify:
- [ ] First workout session is present
- [ ] Most recent workout session is present
- [ ] Spot-check 3-5 sessions from the middle
- [ ] AI responses are not truncated (full exercise prescriptions visible)
- [ ] Structure is parseable (clear turn boundaries between user and AI)

## RAG Strategy Decision Framework

### Decision Process (VALID-03)

After measuring token count (VALID-01), apply these thresholds:

| Token Count | Strategy | Rationale |
|-------------|----------|-----------|
| < 100K tokens | **Context stuffing only** | Fits easily in 1M window. No RAG needed for Phase 2. Build RAG in Phase 3 for growth. |
| 100K - 200K tokens | **Context stuffing + caching** | Still fits. Use Gemini context caching to reduce cost (~75% savings on repeated queries). Build RAG in Phase 3. |
| 200K - 500K tokens | **Hybrid: context stuffing + selective RAG** | Approaching 50% of window where accuracy degrades. Use RAG to retrieve relevant chunks, stuff those into context. |
| > 500K tokens | **Full RAG required** | Too large for reliable context stuffing. Must chunk, embed, and retrieve. Phase 3 becomes critical path. |

### Key Metrics to Capture
- **Total token count** of the exported conversation
- **Approximate word count** (for human reference)
- **Number of distinct workout sessions** mentioned
- **Date range covered** (months of coaching history)

### Why Context Stuffing Works Here (If Corpus Is Small Enough)
- Gemini 2.5 Flash: 1M token context, $0.30/1M input tokens
- Gemini achieves ~99% accuracy on single-needle retrieval in long context
- Context caching reduces repeated-query costs by 75%
- Single-user app means low query volume (cost is manageable)
- The data is one continuous conversation (temporal coherence helps the model)

### Why RAG Still Matters (Phase 3)
- Coaching history will **grow** with every workout -- eventually exceeds any window
- RAG enables **semantic search** ("What did I squat last month?") that's faster than context scanning
- RAG provides **structured retrieval** -- can tag chunks by date, exercise, program
- Cost scales better: RAG queries only the relevant chunks, not the entire history

## Gemini Model Selection

| Use Case | Model | Why |
|----------|-------|-----|
| Token counting | `gemini-2.5-flash` | Use the same model you'll generate with for accurate counts |
| Development/testing | `gemini-2.5-flash` | Cheapest ($0.30/1M input), 1M context, fast |
| Embeddings | `gemini-embedding-001` | Latest, best quality, 3072 dims (use 768 for this project) |
| Structured output | `gemini-2.5-flash` | Supports JSON schema, Zod integration, good enough for workout parsing |
| Production coaching | `gemini-2.5-flash` or `gemini-2.5-pro` | Flash for cost; Pro for quality. Start with Flash, upgrade if coaching quality is insufficient. |

### Embedding Configuration
- **Model:** `gemini-embedding-001`
- **Dimensions:** 768 (reduced from default 3072 via MRL -- sufficient for workout domain, saves storage)
- **Task type for indexing:** `RETRIEVAL_DOCUMENT`
- **Task type for queries:** `RETRIEVAL_QUERY`
- **Pricing:** Free (text-embedding models have no charge as of Feb 2026)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@google/generative-ai` SDK | `@google/genai` SDK (v1.42+) | May 2025 (GA) | Old SDK EOL Nov 2025. Must use new SDK. |
| `text-embedding-004` (768d) | `gemini-embedding-001` (3072d, MRL) | 2025 | 4x more dimensions, top MTEB ranking, deprecated Aug 2025 |
| `chromadb` v2 (bundled embeddings) | `chromadb` v3 (modular packages) | June 2025 | Embedding functions now separate npm packages |
| RAG as default for all document QA | Long context + RAG hybrid | 2025-2026 | 1M token windows make pure RAG unnecessary for small corpora |

**Deprecated/outdated:**
- `@google/generative-ai`: Permanently end-of-life August 2025. Do not use.
- `text-embedding-004`: Deprecated August 2025. Use `gemini-embedding-001`.
- ChromaDB JS client v2 API: v3 changes client initialization and embedding function patterns.

## Open Questions

1. **Exact Google Takeout export format for Gemini conversations**
   - What we know: Takeout produces JSON files. Third-party reports say content may be truncated.
   - What's unclear: The exact JSON schema of Takeout Gemini exports. Whether it preserves conversation turn structure or flattens it.
   - Recommendation: Export via Takeout first, inspect the format, and have Chrome extension as backup. The validation script (VALID-01) should handle both formats.

2. **ChromaDB persistent client for JavaScript**
   - What we know: Python has `PersistentClient` that embeds the DB in-process. JavaScript client is HTTP-only.
   - What's unclear: Whether there's a way to run ChromaDB embedded in Node.js without a separate server process.
   - Recommendation: Run ChromaDB as a separate server (`npx chroma run --path ./chroma-data`). For the validation script, this is fine. For deployment, ChromaDB server needs to be part of the deployment architecture.

3. **ChromaDB `@chroma-core/google-gemini` dimension configuration**
   - What we know: `gemini-embedding-001` supports 768/1536/3072 dimensions via MRL.
   - What's unclear: Whether the `@chroma-core/google-gemini` package exposes a dimension parameter, or if that must be configured at the Gemini API level directly.
   - Recommendation: Test during VALID-02. If the package doesn't support dimension config, use the Gemini SDK directly for embeddings and pass raw vectors to ChromaDB.

## Sources

### Primary (HIGH confidence)
- [Gemini Embeddings API](https://ai.google.dev/gemini-api/docs/embeddings) - Embedding models, task types, JS SDK usage
- [Gemini Token Counting API](https://ai.google.dev/api/tokens) - countTokens method, response fields
- [Gemini Structured Output](https://ai.google.dev/gemini-api/docs/structured-output) - JSON mode, Zod integration, responseMimeType
- [Gemini Long Context](https://ai.google.dev/gemini-api/docs/long-context) - Best practices, caching, when to use vs RAG
- [Drizzle ORM SQLite Setup](https://orm.drizzle.team/docs/get-started-sqlite) - Installation, connection, driver options
- [Drizzle Schema Declaration](https://orm.drizzle.team/docs/sql-schema-declaration) - Table definition, column types, relations
- [Drizzle Kit Migrations](https://orm.drizzle.team/docs/kit-overview) - generate, push, migrate commands
- [Hono Node.js Setup](https://hono.dev/docs/getting-started/nodejs) - Server setup, static files, Node.js adapter
- [Hono Best Practices](https://hono.dev/docs/guides/best-practices) - Route organization, type safety
- [Hono CORS Middleware](https://hono.dev/docs/middleware/builtin/cors) - CORS configuration
- [ChromaDB Google Gemini Integration](https://docs.trychroma.com/integrations/embedding-models/google-gemini) - Embedding function setup
- [ChromaDB JS Client v3 Changelog](https://www.trychroma.com/changelog/js-client-v3) - Breaking changes, new features

### Secondary (MEDIUM confidence)
- [ChromaDB Cookbook - Clients](https://cookbook.chromadb.dev/core/clients/) - Client types, connection options
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) - Per-token costs, caching discounts
- [gemini-exporter GitHub](https://github.com/Liyue2341/gemini-exporter) - Export tool capabilities, JSON format

### Tertiary (LOW confidence)
- Various WebSearch results on Google Takeout Gemini export format - Truncation reports from community forums
- WebSearch results on RAG vs context stuffing thresholds - Token threshold recommendations vary by source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs, versions confirmed on npm
- Architecture: MEDIUM-HIGH - Patterns from official docs; project structure is Claude's recommendation based on Hono/Drizzle best practices
- Pitfalls: MEDIUM - Combination of official docs (SQLite ALTER limits, SDK deprecation) and community reports (Takeout truncation, ChromaDB JS limitations)
- RAG strategy: MEDIUM - Thresholds synthesized from multiple sources; specific numbers (200K, 500K) are informed recommendations, not hard rules

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days - stack is stable, Gemini API evolves but core patterns are established)
