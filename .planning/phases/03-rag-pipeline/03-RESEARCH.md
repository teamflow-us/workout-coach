# Phase 3: RAG Pipeline - Research

**Researched:** 2026-02-21
**Domain:** RAG pipeline (import, chunking, embedding, retrieval, write-back) with ChromaDB + Gemini
**Confidence:** HIGH (stack proven in Phase 1; API details verified with official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Chunking strategy:** Chunk by workout session -- each chunk = one complete workout discussion (request + generated plan + feedback). Keep full conversation text intact within each chunk.
- **Retrieval transparency:** AI explicitly cites past workouts ("Based on your Feb 10 session..."). Expandable "Sources used" section below AI responses showing 1-2 line snippet previews. When no relevant history exists, AI coaches normally without flagging the gap.
- **Memory scope:** Store everything from every exchange. All conversation content is fair game for the knowledge base. Recency weighting on retrieval. Merge coaching profile data into RAG. Retrieve 3-5 most relevant past sessions per workout generation.
- **Write-back behavior:** Embed immediately on each message send (both user and AI). Enrich chunks with metadata tags (exercise names, muscle groups, dates). If embedding fails, warn user subtly but let conversation continue.

### Claude's Discretion
- Session boundary detection algorithm for the Gemini export
- Whether to split long sessions or keep them whole
- Exact metadata extraction approach for tagging chunks
- ChromaDB collection structure and indexing strategy
- Embedding retry/queue mechanism for failures
- How recency weighting is implemented in retrieval scoring

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RAG-01 | Import exported Gemini conversation as seed knowledge base | Session boundary detection via "You said" markers + time/content heuristics; custom GeminiEmbeddingFunction proven in Phase 1; batch import with ChromaDB add() |
| RAG-02 | Conversation-aware chunking (by coaching exchange, not fixed token size) | Each chunk = one workout session (user messages + AI responses between session boundaries); enriched with metadata (date, exercises, muscle groups) |
| RAG-03 | Semantic retrieval of relevant training history during workout generation | ChromaDB query() with queryTexts, metadata where filters for recency weighting, post-retrieval re-scoring by date proximity |
| RAG-04 | New workout feedback automatically embedded and added to knowledge base | Hook into existing chat.ts message persistence -- after DB insert, embed and upsert to ChromaDB asynchronously |
</phase_requirements>

## Summary

Phase 3 builds the persistent memory layer. The Gemini coaching export (395KB, 106K tokens, 179 user turns) must be parsed into session-level chunks, embedded with `gemini-embedding-001`, and stored in ChromaDB. The retrieval pipeline then injects relevant past training context into the system prompt before each AI generation call. A write-back loop ensures every new conversation exchange is embedded and stored immediately.

The entire stack was validated in Phase 1: ChromaDB server on port 8100 (Python CLI), custom `GeminiEmbeddingFunction` wrapping `@google/genai`, and cosine-distance semantic search returning correct results. The key new work is (a) the import parser that detects session boundaries in the Gemini export, (b) the retrieval integration into the existing `buildSystemPrompt()` pipeline, and (c) the write-back hook in the chat and workout generation routes.

The export format is well-structured: "You said" markers delimit user turns, and sessions are separated by topic shifts and time gaps. The coaching profile data (maxes, injuries, equipment) should also be embedded as a special chunk so it participates in semantic retrieval rather than being a separate system prompt injection.

**Primary recommendation:** Use a single ChromaDB collection with cosine distance. Parse sessions using "You said" markers + content heuristics. Embed at 768 dimensions (MRL-reduced from 3072) to save storage with negligible quality loss. Implement recency weighting as a post-retrieval re-score combining semantic similarity with date proximity.

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `chromadb` | 3.3.1 | Vector store JS client | Already installed and proven in Phase 1 test |
| `@google/genai` | 1.42+ | Gemini API (embeddings + generation) | Already used for chat/generation in Phase 2 |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` | latest | Environment variables | GEMINI_API_KEY, CHROMA_HOST, CHROMA_PORT |

### New Dependencies: None

No new npm packages required. The entire RAG pipeline uses `chromadb` (already installed) with the custom `GeminiEmbeddingFunction` pattern proven in Phase 1.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ChromaDB | Gemini context stuffing (106K fits in 1M window) | Context stuffing was the Phase 1 strategy decision. Phase 3 adds RAG because: data grows with every session, retrieval is faster/cheaper than stuffing 106K+ tokens every call, and semantic search surfaces relevant context that recency alone misses. |
| 768-dim embeddings | 3072-dim (full) | 3072 is highest quality but 4x storage. At 768 dimensions, only 0.26% quality loss per MRL research. 768 requires normalization before cosine similarity. |
| Post-retrieval reranking | ChromaDB where-filter only | Where-filter alone (e.g., date > X) is too coarse. Combining semantic similarity score with a date-decay factor gives better results for training context where both relevance and recency matter. |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── server/
│   ├── lib/
│   │   ├── gemini.ts              # Existing: Gemini client
│   │   ├── coaching.ts            # Modified: buildSystemPrompt() adds RAG retrieval
│   │   ├── guardrails.ts          # Existing: unchanged
│   │   ├── chroma.ts              # NEW: ChromaDB client, embedding function, collection
│   │   └── rag.ts                 # NEW: retrieve(), embed(), recency scoring
│   ├── routes/
│   │   ├── chat.ts                # Modified: write-back hook after message persist
│   │   ├── workouts.ts            # Existing
│   │   ├── profile.ts             # Existing
│   │   └── rag.ts                 # NEW: import endpoint, status endpoint
│   └── db/
│       └── schema.ts              # Existing (no changes needed)
scripts/
├── import-gemini-history.ts       # NEW: Parse + chunk + embed the Gemini export
├── test-chromadb.ts               # Existing Phase 1 validation script
└── validate-export.ts             # Existing Phase 1 validation script
```

### Pattern 1: Custom GeminiEmbeddingFunction (Proven in Phase 1)

**What:** Custom `IEmbeddingFunction` wrapping `@google/genai` directly, because `@chroma-core/google-gemini` bundles an old SDK that cannot use `gemini-embedding-001`.

**When to use:** Every ChromaDB operation (collection creation, add, query).

```typescript
// Source: scripts/test-chromadb.ts (Phase 1, proven working)
import { GoogleGenAI } from '@google/genai'
import type { IEmbeddingFunction } from 'chromadb'

const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768 // MRL-reduced from 3072

class GeminiEmbeddingFunction implements IEmbeddingFunction {
  name = 'GeminiEmbeddingFunction'

  async generate(texts: string[]): Promise<number[][]> {
    // @google/genai supports array of strings via contents (plural)
    const result = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: texts,
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    })
    // Normalize for cosine similarity at non-3072 dimensions
    return result.embeddings!.map(e => normalize(e.values!))
  }
}

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  return norm > 0 ? vec.map(v => v / norm) : vec
}
```

**Confidence:** HIGH -- Phase 1 test-chromadb.ts proves this pattern end-to-end. The 768-dimension with normalization is a recommended improvement over the Phase 1 test which used full 3072.

### Pattern 2: Session Boundary Detection for Gemini Export

**What:** Parse the `data/gemini-export.txt` file into discrete workout sessions based on "You said" markers and content/topic shifts.

**When to use:** One-time import script.

The export format is:
```
[Header lines: title, URL, dates]
You said
[user message text - may span multiple lines]

[AI response text - may span multiple paragraphs until next "You said"]

You said
[next user message]
...
```

**Detection algorithm (Claude's discretion):**
1. Split on `^You said$` line markers to get user-AI exchange pairs
2. Group consecutive exchanges into sessions using:
   - **Topic continuity:** If user message references the same workout or continues a thread (e.g., "now do workout B", "update: my back felt fine"), it belongs to the current session
   - **Time gap heuristic:** Explicit date references in the text (e.g., "Monday: Workout A") indicate new sessions
   - **Content signals:** Messages requesting a new workout plan or reporting results from a completed workout start new sessions
3. Each session becomes one chunk with all user+AI text concatenated

**Confidence:** MEDIUM -- the algorithm must be tuned to this specific export. The "You said" markers are reliable (179 found in Phase 1 validation). Session grouping requires testing against actual content.

### Pattern 3: Recency-Weighted Retrieval

**What:** Combine ChromaDB's semantic similarity score with a time-decay factor so recent sessions rank higher than equally-relevant old sessions.

**When to use:** Every retrieval call before workout generation or chat response.

```typescript
// Retrieve more candidates than needed, then re-rank
const raw = await collection.query({
  queryTexts: [userMessage],
  nResults: 10, // Over-fetch
  include: ['documents', 'metadatas', 'distances'],
})

// Re-score with recency weight
const scored = raw.documents[0].map((doc, i) => {
  const semanticScore = 1 - (raw.distances![0][i] ?? 1) // cosine: lower distance = more similar
  const daysSinceSession = daysBetween(raw.metadatas![0][i]?.date as string, today)
  const recencyScore = Math.exp(-daysSinceSession / 30) // 30-day half-life
  const combinedScore = 0.7 * semanticScore + 0.3 * recencyScore
  return { doc, metadata: raw.metadatas![0][i], score: combinedScore }
})

// Take top 3-5
const topResults = scored.sort((a, b) => b.score - a.score).slice(0, 5)
```

**Confidence:** HIGH for the pattern. The 0.7/0.3 weighting and 30-day half-life are starting values -- tune based on actual retrieval quality. ChromaDB with cosine distance returns values 0-2 (distance, not similarity), so `1 - distance` converts to a 0-1 similarity score.

### Pattern 4: Write-Back Hook (Immediate Embedding)

**What:** After each message is persisted to SQLite, also embed and upsert to ChromaDB. Non-blocking -- failures log a warning but don't interrupt the conversation.

**When to use:** In `chat.ts` POST /send and POST /generate-workout, after the `db.insert(messages)` call.

```typescript
// After persisting messages to SQLite:
await db.insert(messages).values([
  { role: 'user', content: body.message },
  { role: 'model', content: fullText },
])

// Write-back to ChromaDB (fire-and-forget with error handling)
embedAndStore(body.message, fullText, {
  date: new Date().toISOString().split('T')[0],
  exercises: extractExerciseNames(fullText),
  muscleGroups: extractMuscleGroups(fullText),
  type: 'live-session',
}).catch(err => console.warn('RAG write-back failed:', err))
```

**Confidence:** HIGH -- the pattern is straightforward. The metadata extraction (exercise names, muscle groups) will be keyword-based for v1 and can be improved later.

### Pattern 5: RAG-Augmented System Prompt

**What:** Modify `buildSystemPrompt()` to inject retrieved context from ChromaDB alongside the existing profile and recent workouts sections.

**When to use:** Every AI generation call.

```typescript
export async function buildSystemPrompt(userMessage?: string): Promise<string> {
  const profile = await db.query.coachingProfiles.findFirst()
  const recentWorkouts = await db.query.workouts.findMany({ ... })

  // NEW: Retrieve relevant past sessions from RAG
  let ragContext = ''
  if (userMessage) {
    const retrieved = await retrieveRelevantSessions(userMessage, 5)
    if (retrieved.length > 0) {
      ragContext = `## Relevant Training History (from memory)\n${
        retrieved.map(r =>
          `### ${r.metadata.date} session (relevance: ${(r.score * 100).toFixed(0)}%)\n${r.snippet}`
        ).join('\n\n')
      }`
    }
  }

  return `You are an experienced strength and conditioning coach...
${profileSection}
${workoutSection}
${ragContext}
## Guidelines
...
- When referencing past workouts from memory, cite the date and specific details
- Include a "Sources used" section at the end listing which past sessions informed your response`
}
```

**Confidence:** HIGH -- this modifies the existing pattern minimally. The `userMessage` parameter is new but the function signature change is backward-compatible (optional param).

### Anti-Patterns to Avoid
- **Storing raw embedding vectors in SQLite:** ChromaDB handles vector storage and indexing. SQLite stores structured workout data only. Don't duplicate vectors.
- **Blocking on embedding during response streaming:** The write-back must be fire-and-forget. Never make the user wait for embedding to complete before seeing the next chat response.
- **Re-embedding the entire history on every change:** Only embed new messages. The import script handles the backfill once.
- **Using the `@chroma-core/google-gemini` package:** It bundles an old SDK (`@google/genai@0.14.1`) that cannot use `gemini-embedding-001`. Use the custom embedding function.
- **Stuffing all retrieved text into the prompt verbatim:** Truncate each retrieved chunk to a reasonable snippet (300-500 tokens) to avoid ballooning the system prompt. The user decided on 3-5 retrieved sessions, not the full text of each.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vector storage and indexing | Custom vector similarity search | ChromaDB | HNSW indexing, metadata filtering, persistence, battle-tested |
| Text embedding | Custom embedding model | Gemini `gemini-embedding-001` via `embedContent` API | State-of-the-art quality, MRL dimension flexibility, already integrated |
| Cosine similarity math | Manual dot product + normalization | ChromaDB `hnsw:space: cosine` config | Built-in, optimized HNSW graph does this at query time |

**Key insight:** The RAG pipeline's complexity is in the orchestration (parsing, chunking, metadata extraction, retrieval integration, write-back timing), not in the vector operations themselves. ChromaDB + Gemini embeddings handle the hard math. Focus implementation effort on the session parser and the retrieval-to-prompt integration.

## Common Pitfalls

### Pitfall 1: Embedding Dimension Mismatch
**What goes wrong:** Phase 1 used 3072 dimensions. If Phase 3 uses 768, all embeddings in the same collection must use the same dimensionality. Mixing dimensions causes query failures.
**Why it happens:** Changing the `outputDimensionality` parameter without re-embedding existing documents.
**How to avoid:** Decide on 768 dimensions from the start of Phase 3. The import script creates a fresh collection with 768-dim config. The Phase 1 test collection was already deleted (cleanup step in test-chromadb.ts).
**Warning signs:** ChromaDB errors about dimension mismatch on add() or query().

### Pitfall 2: Gemini Embedding Rate Limits
**What goes wrong:** The import script tries to embed 179+ chunks rapidly and hits Gemini API rate limits.
**Why it happens:** Free tier has limited RPM for embeddings. Importing all history at once sends many requests in quick succession.
**How to avoid:** Batch the import with delays between API calls (e.g., 50-100ms between embedding requests). Use the batch `contents` array to embed multiple texts per request where possible. Log progress so the import can be resumed if interrupted.
**Warning signs:** HTTP 429 responses from the Gemini API.

### Pitfall 3: Stale ChromaDB Connection
**What goes wrong:** Server starts but ChromaDB is not running, causing all RAG operations to fail silently.
**Why it happens:** ChromaDB runs as a separate Python process (`chroma run --path ./chroma-data --port 8100`) and must be started independently.
**How to avoid:** Add a health check on server startup that verifies ChromaDB connectivity. If ChromaDB is down, log a warning and disable RAG features gracefully (fall back to the Phase 2 behavior of profile + recent workouts only).
**Warning signs:** Connection refused errors on port 8100.

### Pitfall 4: Session Boundary Detection Errors
**What goes wrong:** The parser incorrectly splits or merges sessions, producing chunks that are either too granular (single messages) or too large (entire multi-week threads).
**Why it happens:** The Gemini export is a single continuous conversation with no explicit session markers beyond "You said" turn delimiters.
**How to avoid:** Start with a simple heuristic (group exchanges between obvious topic changes), then visually inspect the first 10-20 chunks. Add a `--dry-run` flag to the import script that shows chunk boundaries without embedding.
**Warning signs:** Chunks with >5000 tokens (too large) or <100 tokens (too small).

### Pitfall 5: ChromaDB IDs Must Be Unique Strings
**What goes wrong:** Attempting to add duplicate IDs silently overwrites existing documents.
**Why it happens:** Using sequential IDs like "chunk-1" across multiple import runs.
**How to avoid:** Use deterministic IDs based on content hash or combine source + index (e.g., `gemini-import-042`, `live-2026-02-21-msg-15`). Check collection count before and after import to verify.
**Warning signs:** Collection.count() doesn't increase as expected after add().

## Code Examples

### ChromaDB Client Module (`src/server/lib/chroma.ts`)

```typescript
// Source: Adapted from scripts/test-chromadb.ts (Phase 1 proven pattern)
import { ChromaClient, type IEmbeddingFunction } from 'chromadb'
import { ai } from './gemini.js'

const CHROMA_HOST = process.env.CHROMA_HOST || 'localhost'
const CHROMA_PORT = parseInt(process.env.CHROMA_PORT || '8100', 10)
const COLLECTION_NAME = 'coaching-history'
const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  return norm > 0 ? vec.map(v => v / norm) : vec
}

class GeminiEmbeddingFunction implements IEmbeddingFunction {
  name = 'GeminiEmbeddingFunction'

  async generate(texts: string[]): Promise<number[][]> {
    const result = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: texts,
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    })
    return result.embeddings!.map(e => normalize(e.values!))
  }
}

const embedder = new GeminiEmbeddingFunction()
const client = new ChromaClient({ host: CHROMA_HOST, port: CHROMA_PORT })

export async function getCollection() {
  return client.getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction: embedder,
    metadata: { 'hnsw:space': 'cosine' },
  })
}

export { embedder, client, COLLECTION_NAME }
```

### Retrieval Function (`src/server/lib/rag.ts`)

```typescript
import { getCollection } from './chroma.js'

interface RetrievedSession {
  id: string
  document: string
  snippet: string // truncated for prompt injection
  metadata: Record<string, unknown>
  score: number
}

export async function retrieveRelevantSessions(
  query: string,
  topK: number = 5,
): Promise<RetrievedSession[]> {
  const collection = await getCollection()
  const today = new Date().toISOString().split('T')[0]

  const raw = await collection.query({
    queryTexts: [query],
    nResults: topK * 2, // over-fetch for re-ranking
    include: ['documents', 'metadatas', 'distances'],
  })

  if (!raw.documents?.[0]?.length) return []

  const scored = raw.documents[0].map((doc, i) => {
    const distance = raw.distances![0][i] ?? 1
    const semanticScore = 1 - distance // cosine distance to similarity
    const sessionDate = raw.metadatas![0][i]?.date as string || '2026-01-01'
    const daysSince = Math.max(0, daysBetween(sessionDate, today))
    const recencyScore = Math.exp(-daysSince / 30)
    const combined = 0.7 * semanticScore + 0.3 * recencyScore

    return {
      id: raw.ids[0][i],
      document: doc ?? '',
      snippet: (doc ?? '').slice(0, 800), // ~200 tokens
      metadata: raw.metadatas![0][i] ?? {},
      score: combined,
    }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

function daysBetween(dateA: string, dateB: string): number {
  const msPerDay = 86400000
  return Math.floor(
    (new Date(dateB).getTime() - new Date(dateA).getTime()) / msPerDay
  )
}
```

### Import Script Pattern (`scripts/import-gemini-history.ts`)

```typescript
// Parse "You said" markers into exchange pairs, group into sessions
function parseExport(text: string): Array<{ user: string; ai: string }> {
  const parts = text.split(/^You said$/m)
  const exchanges: Array<{ user: string; ai: string }> = []

  for (let i = 1; i < parts.length; i++) {
    const content = parts[i].trim()
    // User message ends at the first AI response paragraph break
    // (AI responses are separated from user text by a blank line)
    const [userMsg, ...aiParts] = content.split(/\n\n/)
    exchanges.push({
      user: userMsg.trim(),
      ai: aiParts.join('\n\n').trim(),
    })
  }
  return exchanges
}

function groupIntoSessions(
  exchanges: Array<{ user: string; ai: string }>
): Array<{ exchanges: Array<{ user: string; ai: string }>; date: string }> {
  // Group by detecting session boundaries:
  // - Explicit day/date references ("Monday:", "Workout A:", "Week 3")
  // - Topic shifts (new workout requests vs. feedback on existing)
  // - Long exchanges (>10 turns) may need splitting with overlap
  // Implementation: iterate exchanges, start new session on boundary signals
  ...
}
```

### Metadata Extraction Pattern

```typescript
const EXERCISE_KEYWORDS = [
  'squat', 'bench', 'deadlift', 'press', 'row', 'pull-up', 'dip',
  'curl', 'lunge', 'bridge', 'plank', 'pushup', 'push-up',
  'overhead press', 'floor press', 'inverted row', 'step-up',
]

const MUSCLE_GROUPS: Record<string, string[]> = {
  chest: ['bench', 'press', 'pushup', 'push-up', 'dip', 'floor press'],
  back: ['row', 'pull-up', 'pullup', 'deadlift', 'inverted row'],
  legs: ['squat', 'lunge', 'step-up', 'bridge', 'glute'],
  shoulders: ['overhead press', 'lateral raise', 'military press'],
  core: ['plank', 'deadbug', 'dead bug'],
}

function extractMetadata(text: string): {
  exercises: string[]
  muscleGroups: string[]
} {
  const lower = text.toLowerCase()
  const exercises = EXERCISE_KEYWORDS.filter(ex => lower.includes(ex))
  const muscleGroups = Object.entries(MUSCLE_GROUPS)
    .filter(([_, keywords]) => keywords.some(k => lower.includes(k)))
    .map(([group]) => group)
  return { exercises: [...new Set(exercises)], muscleGroups: [...new Set(muscleGroups)] }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `text-embedding-004` (768-dim fixed) | `gemini-embedding-001` (128-3072 dim, MRL) | Jan 2026 (004 deprecated, shutdown date Jan 14 2026) | Must use gemini-embedding-001; supports flexible dimensionality via outputDimensionality param |
| `@chroma-core/google-gemini` for embeddings | Custom `GeminiEmbeddingFunction` | Phase 1 discovery | @chroma-core/google-gemini bundles `@google/genai@0.14.1` (v1beta), cannot use gemini-embedding-001 |
| `zodToJsonSchema()` for Gemini schemas | `z.toJSONSchema()` native Zod v4 | Phase 1 discovery | zod-to-json-schema produces empty definitions with Zod v4 |
| ChromaDB JS bindings (`npx chroma`) | Python CLI (`chroma run`) | Phase 1 discovery | JS bindings require GLIBC_2.39 unavailable on this system |
| Full 3072-dim embeddings | 768-dim with normalization | Current recommendation | 0.26% quality loss, 75% storage savings; requires L2-normalization |

**Deprecated/outdated:**
- `text-embedding-004`: Shutdown Jan 14, 2026. Replaced by `gemini-embedding-001`.
- `@google/generative-ai` SDK: Replaced by `@google/genai` (GA since May 2025).
- `@chroma-core/google-gemini`: Bundles old SDK; unusable with current Gemini embedding model.

## Open Questions

1. **Exact session boundary heuristics for the Gemini export**
   - What we know: "You said" markers reliably delimit 179 user turns. The export is one continuous conversation spanning ~7 weeks of training.
   - What's unclear: The exact pattern that separates "workout session A discussion" from "workout session B discussion" within the continuous thread. Some exchanges are quick follow-ups ("update: my shoulder felt fine"), others start new workout requests.
   - Recommendation: Build the parser with a `--dry-run` mode, manually inspect first 20 chunks, iterate on heuristics. Start with simple date/day-name detection + new-workout-request signals.

2. **Optimal chunk size for embedding quality**
   - What we know: gemini-embedding-001 supports 2048 input tokens per text. The user decided to keep full session text in each chunk.
   - What's unclear: Some sessions may exceed 2048 tokens. The decision says "Claude's discretion on handling long sessions."
   - Recommendation: If a session exceeds ~1800 tokens (leaving headroom), split into sub-chunks with 200-token overlap. Prefix each sub-chunk with the session date and topic for context.

3. **Gemini embedding rate limits for bulk import**
   - What we know: Free tier has rate limits. The import is ~50-100 chunks (estimated from 179 turns grouped into sessions).
   - What's unclear: Exact RPM/TPM limits for gemini-embedding-001 on the user's API tier.
   - Recommendation: Add configurable delay between embedding calls (default 100ms). Use the batch `contents` array (multi-text per request) to reduce total API calls. If rate limited, implement exponential backoff with 3 retries.

4. **ChromaDB persistence across server restarts**
   - What we know: ChromaDB persists to `./chroma-data/` (verified -- directory contains sqlite3 and HNSW files from Phase 1 tests).
   - What's unclear: Whether the Phase 1 test collections are still present or were cleaned up.
   - Recommendation: Phase 3 should create a fresh `coaching-history` collection. The Phase 1 test script deleted its test collection, so the `chroma-data` directory may contain stale data. Consider starting with a fresh `chroma-data` directory for Phase 3.

## Sources

### Primary (HIGH confidence)
- `scripts/test-chromadb.ts` -- Phase 1 proven ChromaDB + Gemini embedding pipeline
- `data/gemini-export.txt` -- Actual export file structure inspected (6744 lines, 179 "You said" markers)
- [Gemini Embeddings API](https://ai.google.dev/gemini-api/docs/embeddings) -- embedContent API, dimensions, batch support
- [ChromaDB Query and Get](https://docs.trychroma.com/docs/querying-collections/query-and-get) -- query API, include params, where filters
- [ChromaDB Metadata Filtering](https://docs.trychroma.com/docs/querying-collections/metadata-filtering) -- $eq, $gt, $gte, $lt, $lte, $in, $and, $or operators

### Secondary (MEDIUM confidence)
- [ChromaDB Batching Cookbook](https://cookbook.chromadb.dev/strategies/batching/) -- manual batching with create_batches utility
- [Gemini Embedding Blog Post](https://developers.googleblog.com/gemini-embedding-available-gemini-api/) -- MRL technique, dimension tradeoffs, 0.26% quality loss at 768-dim
- [ChromaDB Configure Collections](https://docs.trychroma.com/docs/collections/configure) -- hnsw:space cosine config

### Tertiary (LOW confidence)
- Rate limits for gemini-embedding-001 -- could not find specific numbers; depends on user's quota tier. Need to test empirically during import.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and proven in Phase 1
- Architecture: HIGH -- patterns follow directly from Phase 1 validation and Phase 2 integration points
- Session parsing: MEDIUM -- heuristics need testing against actual export content
- Pitfalls: HIGH -- most identified from Phase 1 experience (GLIBC, old SDK, dimension mismatch)

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable stack, no fast-moving dependencies)
