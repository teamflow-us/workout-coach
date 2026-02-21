# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** The AI coaching loop must work: give feedback on a workout in natural language, get an intelligently adjusted next workout that reflects your full training history.
**Current focus:** Phase 3 complete - RAG pipeline fully integrated. AI retrieves past training context, cites sessions, and auto-embeds new exchanges. Ready for Phase 4.

## Current Position

Phase: 3 of 4 (RAG Pipeline)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-02-21 - Completed 03-02-PLAN.md (RAG integration, write-back hooks, Sources UI)

Progress: [████████░░] 75%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 8.2 min
- Total execution time: 49 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 2/2 | 13 min | 6.5 min |
| 2 | 2/2 | 19 min | 9.5 min |
| 3 | 2/2 | 17 min | 8.5 min |

**Recent Trend:**
- Last 5 plans: 03-02 (3 min), 03-01 (14 min), 02-02 (12 min), 02-01 (7 min), 01-02 (5 min)
- Trend: 03-02 was fastest plan yet -- clean integration with no blockers

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 4 phases derived from 27 requirements at quick depth
- [01-01]: RAG strategy decided: context stuffing + caching (106K tokens fits 1M window)
- [01-01]: Zod v4: use z.toJSONSchema() natively, not zodToJsonSchema() (broken with v4)
- [01-01]: ChromaDB Python server on port 8100 (port 8000 occupied, JS bindings need newer GLIBC)
- [01-02]: Used sql`(CURRENT_TIMESTAMP)` for createdAt default (Drizzle string literal bug)
- [01-02]: WAL mode and FK enforcement enabled on SQLite connection
- [01-02]: Gemini client wrapper is standalone, not imported by server entry
- [02-01]: Dual-mode AI: streaming text for chat, non-streaming JSON for workout generation
- [02-01]: Server-side history: DB messages converted to Gemini Content[] on each request
- [02-01]: Explicit workout generation via button (not AI intent detection)
- [02-02]: Three-tab bottom nav (Chat / Workout / Profile) for mobile gym use
- [02-02]: Rest timer overlay with color transitions (green -> yellow -> red at <10s)
- [02-02]: Wake lock activates on Workout tab, releases on tab switch
- [03-01]: 768-dim MRL-reduced embeddings with L2 normalization (0.26% quality loss, 75% storage savings)
- [03-01]: Session boundary detection uses content-based heuristics (93 sessions from 179 exchanges)
- [03-01]: Export format uses ## User (Turn N) / ## Gemini markers, not "You said"
- [03-01]: Single-chunk embedding with 3s delay to avoid Gemini API rate limits
- [03-01]: chromadb 3.3.1 exports EmbeddingFunction type (not IEmbeddingFunction)
- [03-02]: buildSystemPrompt returns { prompt, sources } object for RAG integration
- [03-02]: Sources SSE event sent before done event for client-side attachment
- [03-02]: Fire-and-forget write-back with .catch() for non-blocking embedding
- [03-02]: HTML <details> element for collapsible sources UI (zero JS)
- [03-02]: ChromaDB metadata stored as comma-separated strings for primitive type compatibility

### Pending Todos

None.

### Blockers/Concerns

- [Resolved]: @chroma-core/google-gemini package is unusable -- custom GeminiEmbeddingFunction implemented in chroma.ts
- [Phase 3+]: zod-to-json-schema broken with Zod v4; use z.toJSONSchema() exclusively
- [Resolved]: ChromaDB JS bindings require GLIBC_2.39 -- using Python CLI for server
- [Resolved]: Gemini embedding API rate limits for live write-back -- handled via fire-and-forget with error logging

## Session Continuity

Last session: 2026-02-21T23:09:43Z
Stopped at: Completed 03-02-PLAN.md (RAG integration, write-back hooks, Sources UI) -- Phase 3 complete
Resume file: None
