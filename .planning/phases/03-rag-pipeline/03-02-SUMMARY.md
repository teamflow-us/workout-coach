---
phase: 03-rag-pipeline
plan: 02
subsystem: rag, ai-coaching, chat-ui
tags: [rag-retrieval, system-prompt, write-back, sse-sources, chromadb, graceful-degradation, details-element]

# Dependency graph
requires:
  - phase: 03-rag-pipeline-plan-01
    provides: ChromaDB client, retrieveRelevantSessions, embedAndStore, extractMetadata, checkChromaHealth
  - phase: 02-ai-coaching-loop
    provides: buildSystemPrompt, chat SSE streaming, workout generation, ChatMessage component, useChat hook
provides:
  - RAG-augmented system prompt with retrieved training history and relevance scores
  - Write-back hooks embedding new chat and workout exchanges into ChromaDB automatically
  - Sources SSE event in chat streaming pipeline
  - Collapsible Sources UI on AI chat messages
  - RAG status and collection-info monitoring endpoints
  - Graceful degradation to profile-only mode when ChromaDB unavailable
affects: [04-progress-diet-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns: [rag-augmented-system-prompt, fire-and-forget-write-back, sse-sources-event, collapsible-details-ui, graceful-chromadb-degradation]

key-files:
  created:
    - src/server/routes/rag.ts
  modified:
    - src/server/lib/coaching.ts
    - src/server/routes/chat.ts
    - src/server/index.ts
    - src/client/components/ChatMessage.tsx
    - src/client/hooks/useChat.ts
    - src/client/components/Chat.tsx
    - src/client/styles/global.css

key-decisions:
  - "buildSystemPrompt returns { prompt, sources } object instead of string for backward-compatible RAG integration"
  - "Sources SSE event sent before done event so client can attach sources before message finalization"
  - "Fire-and-forget write-back with .catch() for non-blocking embedding (per Phase 3 concern about rate limits)"
  - "HTML <details> element for collapsible sources -- zero JS, native browser behavior"
  - "Metadata stored as comma-separated strings (exercises, muscleGroups) for ChromaDB compatibility"

patterns-established:
  - "RAG-augmented system prompt: retrieve -> format -> inject section with relevance scores"
  - "SSE event pipeline: chunks -> sources -> done (sources always before done)"
  - "Fire-and-forget async pattern: call .catch() to log but never block response"
  - "Collapsible UI via <details>/<summary> for progressive disclosure"

requirements-completed: [RAG-03, RAG-04]

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 3 Plan 2: RAG Integration & Sources UI Summary

**RAG-augmented coaching with retrieved training history in system prompt, automatic write-back to ChromaDB on every exchange, and collapsible Sources UI showing which past sessions the AI referenced**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T23:05:46Z
- **Completed:** 2026-02-21T23:09:43Z
- **Tasks:** 2
- **Files modified:** 7 modified, 1 created

## Accomplishments

- buildSystemPrompt() now retrieves relevant past sessions from ChromaDB when given a user message, injecting a "Relevant Training History" section with dates and relevance percentages
- Both /send (streaming) and /generate-workout endpoints include RAG context and fire-and-forget write-back to ChromaDB
- SSE streaming sends a `sources` event before `done` so the client can attach retrieved session metadata to AI messages
- ChatMessage component renders a collapsible "Sources used (N)" section using native HTML `<details>` element
- RAG status endpoint at /api/rag/status reports ChromaDB health and collection count
- Server startup logs ChromaDB connection status with chunk count for operational visibility
- Full graceful degradation: if ChromaDB is down, the app falls back to Phase 2 behavior with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: RAG-augmented system prompt and write-back hooks** - `2e2e322` (feat)
2. **Task 2: Sources UI on chat messages** - `48c91a1` (feat)

## Files Created/Modified

- `src/server/lib/coaching.ts` - buildSystemPrompt now accepts userMessage, returns { prompt, sources }, includes RAG retrieval with try/catch graceful degradation
- `src/server/routes/chat.ts` - /send and /generate-workout use RAG context, send sources SSE event, fire-and-forget write-back via embedAndStore
- `src/server/routes/rag.ts` - NEW: GET /status (health + count), GET /collection-info (sample metadata)
- `src/server/index.ts` - Mounts /api/rag routes, startup ChromaDB health check with logging
- `src/client/hooks/useChat.ts` - ChatMessage type extended with sources, SSE consumer handles sources event, attaches on done
- `src/client/components/ChatMessage.tsx` - Collapsible "Sources used" section with date, relevance %, truncated snippet
- `src/client/components/Chat.tsx` - Passes sources prop to ChatMessage
- `src/client/styles/global.css` - Sources UI styles (collapsible details, source items, muted typography)

## Decisions Made

1. **Return object instead of string from buildSystemPrompt:** Changed return type to `{ prompt, sources }` so callers get both the augmented prompt and the sources metadata for UI display. Backward-compatible since the only callers are in chat.ts.

2. **Sources SSE event before done:** The sources event is sent after streaming completes but before the done event. This lets the client store sources in a ref and attach them when the message is finalized, without disrupting the chunk streaming flow.

3. **Fire-and-forget write-back pattern:** embedAndStore is called with `.catch()` to log but never block the response. This handles Gemini API rate limits gracefully -- if embedding fails, the conversation still works and the warning is logged.

4. **Native HTML details for sources:** Used `<details>/<summary>` instead of a React state toggle. Zero JS overhead, accessible by default, and collapsed by default per HTML spec.

5. **Comma-separated metadata strings:** ChromaDB metadata only supports primitive types. Exercises and muscle groups are stored as comma-separated strings rather than arrays.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing uncommitted CSS changes (theme overhaul from earlier session) were included in Task 2 commit since the sources CSS builds on top of the current theme system. These changes were already deployed on disk and are not new work from this plan.

## User Setup Required

None - ChromaDB server must be running (`chroma run --path ./chroma-data --port 8100`) but this was set up in Phase 1.

## Next Phase Readiness

- RAG pipeline is fully integrated: retrieval in system prompt, write-back on every exchange, sources displayed to user
- Phase 3 is complete -- all 4 RAG requirements delivered (RAG-01 through RAG-04)
- Ready for Phase 4: Progress tracking, diet guidance, and deployment
- ChromaDB knowledge base will continue growing with each conversation via automatic write-back

---
*Phase: 03-rag-pipeline*
*Completed: 2026-02-21*
