# Phase 1: Validation and Foundation - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Resolve critical unknowns (Gemini conversation export quality, token counts, ChromaDB embedding pipeline) and stand up the full-stack skeleton (Hono backend, SQLite with Drizzle, React shell). This phase produces the validated platform everything else builds on.

</domain>

<decisions>
## Implementation Decisions

### Gemini export approach
- Source is one mega-thread in the Gemini web app (gemini.google.com)
- Export via manual copy-paste from the single thread into a text file
- Quality bar: ALL workouts must be present (no missing sessions) AND the structure must be clear enough to parse programmatically (identify individual workouts, exercises, and sets)
- Validation step: manually spot-check exported data against memory of recent workouts to confirm completeness

### Claude's Discretion
- **Workout data model**: Schema design for SQLite — how to model workouts, exercises, sets, reps, weight, programs vs sessions. Claude decides based on what the coaching loop needs downstream.
- **Backend API shape**: REST vs RPC, endpoint design, auth approach for single-user app. Claude decides based on simplicity and what Phase 2 will consume.
- **RAG strategy decision process**: How to evaluate context stuffing vs hybrid vs full RAG — thresholds, criteria, and measurement approach. Claude decides based on token count results.

</decisions>

<specifics>
## Specific Ideas

- The Gemini conversation is one continuous mega-thread covering the full coaching history — this means the export is a single large document, not many small ones
- The user has been coaching with Gemini via the web chat interface, so the data is conversational (user messages + Gemini responses alternating)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-validation-and-foundation*
*Context gathered: 2026-02-21*
