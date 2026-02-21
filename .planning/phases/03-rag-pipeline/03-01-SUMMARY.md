---
phase: 03-rag-pipeline
plan: 01
subsystem: rag, embedding, vector-store
tags: [chromadb, gemini-embedding-001, rag, vector-search, session-chunking, 768-dim, cosine-distance]

# Dependency graph
requires:
  - phase: 01-validation-and-foundation
    provides: ChromaDB + Gemini embedding pipeline proven, export validated
provides:
  - ChromaDB client module with custom GeminiEmbeddingFunction (768-dim)
  - RAG utility library (retrieve with recency weighting, embed+store, metadata extraction)
  - Full Gemini coaching history imported (106 chunks in coaching-history collection)
  - Coaching profile embedded as queryable chunk
  - Import script with --dry-run, --delay, resume support
affects: [03-rag-pipeline-plan-02, 04-polish-and-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns: [768-dim-mrl-embeddings-with-normalization, recency-weighted-retrieval, session-boundary-detection, deterministic-chunk-ids, fire-and-forget-write-back]

key-files:
  created:
    - src/server/lib/chroma.ts
    - src/server/lib/rag.ts
    - scripts/import-gemini-history.ts
    - scripts/test-chroma-client.ts
    - scripts/verify-rag-import.ts
  modified: []

key-decisions:
  - "768-dim MRL-reduced embeddings with L2 normalization (0.26% quality loss, 75% storage savings vs 3072-dim)"
  - "Session boundary detection uses content-based heuristics (workout requests, result reports, follow-up patterns)"
  - "93 sessions from 179 exchanges, 105 total chunks after splitting long sessions at 1800 tokens"
  - "Export format uses ## User (Turn N) / ## Gemini markers (not 'You said' as initially assumed)"
  - "Single-chunk-at-a-time embedding with 3s delay to avoid Gemini API rate limits"
  - "EmbeddingFunction type (not IEmbeddingFunction) in chromadb 3.3.1"

patterns-established:
  - "GeminiEmbeddingFunction with 768-dim outputDimensionality and L2 normalization for cosine similarity"
  - "Recency-weighted retrieval: 0.7 * semantic + 0.3 * time-decay (30-day half-life)"
  - "Deterministic chunk IDs: gemini-import-NNN for history, live-{date}-msg-{hash} for live sessions"
  - "checkChromaHealth() for graceful degradation when ChromaDB is unavailable"

requirements-completed: [RAG-01, RAG-02]

# Metrics
duration: 14min
completed: 2026-02-21
---

# Phase 3 Plan 1: ChromaDB Integration & History Import Summary

**ChromaDB client with 768-dim Gemini embeddings, full 7-week coaching history imported as 106 searchable session-level chunks with recency-weighted semantic retrieval**

## Performance

- **Duration:** 14 min
- **Started:** 2026-02-21T22:48:35Z
- **Completed:** 2026-02-21T23:03:08Z
- **Tasks:** 2
- **Files modified:** 5 created

## Accomplishments

- Built ChromaDB client module with custom GeminiEmbeddingFunction using 768-dim MRL-reduced embeddings (75% storage savings vs Phase 1's 3072-dim)
- Created RAG utility library with recency-weighted retrieval (0.7 semantic + 0.3 time decay), fire-and-forget write-back, and keyword-based metadata extraction
- Imported full Gemini coaching history: 179 exchanges grouped into 93 sessions, split into 105 chunks + 1 coaching profile = 106 total
- Semantic search verified: "squat workout", "back pain", "floor press progression" all return contextually relevant results
- Import script supports --dry-run inspection, --delay rate limit control, and resume from partial imports

## Task Commits

Each task was committed atomically:

1. **Task 1: ChromaDB client module and RAG utility library** - `f3bcf35` (feat)
2. **Task 2: Import Gemini coaching history into ChromaDB** - `f557cda` (feat)

## Files Created/Modified

- `src/server/lib/chroma.ts` - ChromaDB client, GeminiEmbeddingFunction (768-dim), getCollection, checkChromaHealth
- `src/server/lib/rag.ts` - retrieveRelevantSessions (recency-weighted), embedAndStore (fire-and-forget), extractMetadata (keyword-based)
- `scripts/import-gemini-history.ts` - Parse Gemini export, group into sessions, embed, store with rate limit handling
- `scripts/test-chroma-client.ts` - Verify ChromaDB connectivity and metadata extraction
- `scripts/verify-rag-import.ts` - Semantic query verification against imported data

## Decisions Made

1. **768-dim embeddings instead of 3072-dim:** MRL-reduced from 3072 to 768 dimensions using `outputDimensionality` parameter. Requires L2 normalization for cosine similarity. 0.26% quality loss per MRL research, 75% storage savings. Phase 1 used 3072 for testing; Phase 3 uses 768 for production.

2. **Session boundary detection heuristics:** Content-based detection using regex patterns for new-workout requests, result reports, weight check-ins, and follow-up signals. Produced 93 sessions from 179 exchanges -- reasonable grouping (average 1.9 exchanges per session, with some large multi-exchange sessions).

3. **Export format adaptation:** The plan specified "You said" markers but the actual export uses `## User (Turn N)` and `## Gemini` headers with `---` separators. Adapted the parser accordingly.

4. **One-at-a-time embedding with 3s delay:** Gemini free tier rate limits hit at batch-of-10 pace. Reduced to single-document embedding with 3-second delay between API calls. Import takes ~5 minutes but completes reliably.

5. **EmbeddingFunction type name:** chromadb 3.3.1 exports `EmbeddingFunction` (not `IEmbeddingFunction` as in the Phase 1 test script). Updated import accordingly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Export format uses different markers than expected**
- **Found during:** Task 2 (parsing Gemini export)
- **Issue:** Plan specified "You said" markers but actual export uses `## User (Turn N)` / `## Gemini` / `---` format
- **Fix:** Wrote parser targeting the actual markdown format with regex for `## User (Turn N)` headers
- **Files modified:** scripts/import-gemini-history.ts
- **Verification:** All 179 exchanges parsed correctly
- **Committed in:** f557cda (Task 2 commit)

**2. [Rule 1 - Bug] chromadb 3.3.1 exports EmbeddingFunction, not IEmbeddingFunction**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `IEmbeddingFunction` type from Phase 1 test no longer exists in chromadb 3.3.1
- **Fix:** Changed import to use `EmbeddingFunction` type
- **Files modified:** src/server/lib/chroma.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** f3bcf35 (Task 1 commit)

**3. [Rule 1 - Bug] Gemini API rate limit (429) during bulk import**
- **Found during:** Task 2 (embedding import)
- **Issue:** Batch-of-10 embedding calls hit rate limit after 20-30 chunks
- **Fix:** Added exponential backoff retry (15s/30s/60s/120s/240s), reduced to single-chunk-at-a-time embedding, added 3s default delay, added resume support to skip already-imported chunks
- **Files modified:** scripts/import-gemini-history.ts
- **Verification:** Full import completes with --delay=3000
- **Committed in:** f557cda (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All necessary for correct operation. Export format mismatch required parser adaptation. Rate limit handling required retry/resume logic. No scope creep.

## Issues Encountered

- ChromaDB cosmetic warning "No embedding function configuration found for collection schema deserialization" appears on every getCollection() call -- does not affect functionality (custom embedding functions work correctly, same as Phase 1)
- Set spread syntax (`[...new Set()]`) not supported with tsconfig target ES2022 without downlevelIteration -- used `Array.from(new Set())` instead

## User Setup Required

None - ChromaDB server must be running (`chroma run --path ./chroma-data --port 8100`) but this was already set up in Phase 1.

## Next Phase Readiness

- ChromaDB client and RAG utilities ready for integration into chat and workout generation routes
- `retrieveRelevantSessions()` ready to inject into `buildSystemPrompt()` for RAG-augmented responses
- `embedAndStore()` ready for write-back hook in chat.ts POST handlers
- `checkChromaHealth()` ready for server startup graceful degradation
- **Concern:** Gemini embedding API rate limits may require the same 3s delay for live write-back -- should fire-and-forget with error logging

---
*Phase: 03-rag-pipeline*
*Completed: 2026-02-21*
