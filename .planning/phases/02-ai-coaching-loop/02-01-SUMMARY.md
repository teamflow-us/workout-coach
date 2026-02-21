---
phase: 02-ai-coaching-loop
plan: 01
subsystem: api, ui, database
tags: [gemini, hono, sse, streaming, react, sqlite, drizzle, zod, chat, coaching]

# Dependency graph
requires:
  - phase: 01-validation-and-foundation
    provides: Hono server, SQLite/Drizzle schema, Gemini client, workout CRUD API, React shell
provides:
  - Chat API with SSE streaming via Gemini sendMessageStream
  - Structured workout generation with JSON schema validation
  - Coaching profile CRUD (maxes, injuries, equipment, preferences)
  - Freeform text workout logging via Gemini parsing
  - Weight guardrail validation against known maxes
  - React chat UI with streaming SSE consumer hook
  - Mobile-first dark theme CSS with 48px gym tap targets
  - Messages persistence table for chat history
  - Coaching profiles table for training context
affects: [02-ai-coaching-loop/02, 03-rag-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SSE streaming: Hono streamSSE + Gemini sendMessageStream -> fetch ReadableStream consumer"
    - "Structured output: Gemini generateContent + responseMimeType application/json + z.toJSONSchema()"
    - "Context stuffing: buildSystemPrompt() loads coaching profile + last 5 workouts into system instruction"
    - "Weight guardrails: fuzzy exercise-to-max matching with 20-120% range validation"
    - "Mobile-first CSS: custom properties, 100dvh, 48px tap targets, dark theme"

key-files:
  created:
    - src/server/lib/coaching.ts
    - src/server/lib/guardrails.ts
    - src/server/routes/chat.ts
    - src/server/routes/profile.ts
    - src/client/hooks/useChat.ts
    - src/client/components/Chat.tsx
    - src/client/components/ChatMessage.tsx
    - src/client/styles/global.css
  modified:
    - src/server/db/schema.ts
    - src/server/index.ts
    - src/server/routes/workouts.ts
    - src/client/App.tsx
    - src/client/main.tsx

key-decisions:
  - "Dual-mode AI: streaming text for chat, non-streaming JSON for workout generation"
  - "Server-side history loading: DB messages converted to Gemini Content[] format on each request"
  - "Explicit workout generation: user clicks button rather than AI auto-detecting intent"

patterns-established:
  - "SSE pattern: POST /api/chat/send -> streamSSE -> writeSSE chunks -> done event"
  - "Structured output pattern: z.toJSONSchema() -> responseMimeType: application/json"
  - "Tab-based navigation: useState activeTab for chat/workout switching"

# Metrics
duration: 7min
completed: 2026-02-21
---

# Phase 2 Plan 1: AI Coaching Loop - Chat and APIs Summary

**Streaming AI chat with Gemini SSE, structured workout generation via JSON schema, freeform workout logging, coaching profile CRUD, and mobile-first dark theme React UI**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-21T21:35:23Z
- **Completed:** 2026-02-21T21:42:10Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- Full streaming chat interface: type a message, see AI response stream word-by-word via SSE
- Chat messages persist in SQLite messages table and reload on page refresh
- Structured workout generation: Gemini produces validated JSON with exercises/sets/reps/weight/rest, saved to database
- Coaching profile (maxes, injuries, equipment, dietary constraints, preferences) stored and used in system prompt
- Weight guardrails flag AI-generated weights outside 20-120% of known maxes
- Freeform text workout logging: natural language parsed into structured exercise/set data
- Mobile-first dark theme with 48px tap targets, 100dvh layout, and gym-friendly UX
- Tabbed app shell with Chat and Workout (placeholder) views

## Task Commits

Each task was committed atomically:

1. **Task 1: Database schema + coaching libraries** - `69f9ff2` (feat)
2. **Task 2: Chat API, profile API, workout generation, freeform logging** - `38724ba` (feat)
3. **Task 3: React chat UI with SSE streaming, app shell, dark theme** - `2094765` (feat)

## Files Created/Modified
- `src/server/db/schema.ts` - Added messages, coachingProfiles tables, restSeconds column on exercises
- `src/server/lib/coaching.ts` - System prompt builder with profile + recent workouts context
- `src/server/lib/guardrails.ts` - Weight validation against known maxes with fuzzy exercise matching
- `src/server/routes/chat.ts` - POST /send (SSE streaming), POST /generate-workout, GET /history
- `src/server/routes/profile.ts` - GET/PUT /profile for coaching profile CRUD
- `src/server/routes/workouts.ts` - Added POST /:id/log for freeform text logging
- `src/server/index.ts` - Mounted chat and profile route modules
- `src/client/hooks/useChat.ts` - Custom hook consuming SSE stream via fetch + ReadableStream
- `src/client/components/Chat.tsx` - Chat message list, input bar, generate workout button
- `src/client/components/ChatMessage.tsx` - Message bubble with basic markdown and timestamps
- `src/client/styles/global.css` - Mobile-first dark theme with CSS custom properties
- `src/client/App.tsx` - Tabbed layout with Chat and Workout views
- `src/client/main.tsx` - Global CSS import

## Decisions Made
- Dual-mode AI responses: streaming text for conversational chat, non-streaming structured JSON for workout generation (avoids partial JSON parsing issues)
- Server-side history management: all messages loaded from DB and converted to Gemini Content[] format on each request (simple, no client-side history tracking needed)
- Explicit workout generation via button click rather than AI auto-detecting intent (simpler UX, clearer separation of concerns)
- Context stuffing approach: coaching profile + last 5 workouts included in system prompt (sufficient for Phase 2, RAG comes in Phase 3)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All chat and API infrastructure is in place for Plan 02 (workout view, rest timer, wake lock, profile editor)
- Messages table populated with test data from API verification
- Coaching profile CRUD ready for the profile editor component
- restSeconds column ready for rest timer display
- Tab navigation ready for workout view integration

---
*Phase: 02-ai-coaching-loop*
*Completed: 2026-02-21*
