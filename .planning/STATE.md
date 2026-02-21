# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** The AI coaching loop must work: give feedback on a workout in natural language, get an intelligently adjusted next workout that reflects your full training history.
**Current focus:** Phase 2 in progress - AI coaching loop chat and APIs complete, workout view next

## Current Position

Phase: 2 of 4 (AI Coaching Loop)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-21 - Completed 02-01-PLAN.md

Progress: [████░░░░░░] 37%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 6.7 min
- Total execution time: 20 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 2/2 | 13 min | 6.5 min |
| 2 | 1/2 | 7 min | 7 min |

**Recent Trend:**
- Last 5 plans: 02-01 (7 min), 01-02 (5 min), 01-01 (8 min)
- Trend: Consistent pace

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

### Pending Todos

None.

### Blockers/Concerns

- [Phase 3+]: @chroma-core/google-gemini package is unusable (bundles old SDK); use custom embedding function
- [Phase 3+]: zod-to-json-schema broken with Zod v4; use z.toJSONSchema() exclusively
- [Phase 3+]: ChromaDB JS bindings require GLIBC_2.39; must use Python CLI for server

## Session Continuity

Last session: 2026-02-21T21:42:10Z
Stopped at: Completed 02-01-PLAN.md
Resume file: None
