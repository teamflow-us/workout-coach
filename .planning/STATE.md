# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** The AI coaching loop must work: give feedback on a workout in natural language, get an intelligently adjusted next workout that reflects your full training history.
**Current focus:** Phase 3 in progress - RAG pipeline. ChromaDB integration and history import complete. Next: retrieval integration and write-back hooks.

## Current Position

Phase: 3 of 4 (RAG Pipeline)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-21 - Completed 03-01-PLAN.md (ChromaDB integration, history import)

Progress: [██████░░░░] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 9.2 min
- Total execution time: 46 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 2/2 | 13 min | 6.5 min |
| 2 | 2/2 | 19 min | 9.5 min |
| 3 | 1/2 | 14 min | 14 min |

**Recent Trend:**
- Last 5 plans: 03-01 (14 min), 02-02 (12 min), 02-01 (7 min), 01-02 (5 min), 01-01 (8 min)
- Trend: Slight increase due to rate limit handling during embedding import

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

### Pending Todos

None.

### Blockers/Concerns

- [Resolved]: @chroma-core/google-gemini package is unusable -- custom GeminiEmbeddingFunction implemented in chroma.ts
- [Phase 3+]: zod-to-json-schema broken with Zod v4; use z.toJSONSchema() exclusively
- [Resolved]: ChromaDB JS bindings require GLIBC_2.39 -- using Python CLI for server
- [Phase 3-Plan 2]: Gemini embedding API rate limits may affect live write-back -- use fire-and-forget with error logging

## Session Continuity

Last session: 2026-02-21T23:03:08Z
Stopped at: Completed 03-01-PLAN.md (ChromaDB integration and history import)
Resume file: None
