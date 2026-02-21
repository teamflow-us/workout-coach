---
phase: 02-ai-coaching-loop
verified: 2026-02-21T22:15:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Send a message in the Chat tab and observe streaming response"
    expected: "AI response text appears word-by-word as tokens arrive, not all at once after a delay"
    why_human: "SSE streaming is structurally wired correctly but real-time visual behavior requires a live browser session to confirm"
  - test: "Generate a workout in Chat, switch to Workout tab, tap Done on a set"
    expected: "Rest timer overlay appears with a large countdown number that decreases smoothly, then disappears when it reaches zero"
    why_human: "Timer countdown behavior and overlay dismiss cannot be confirmed without running the app"
  - test: "Open the app on a phone at 375px viewport width"
    expected: "All text is readable without zooming, all buttons are large enough to tap with a thumb, bottom tab bar is clearly visible and usable"
    why_human: "Mobile ergonomics and readability require a real device or mobile viewport to assess"
---

# Phase 2: AI Coaching Loop Verification Report

**Phase Goal:** User can chat with an AI coach, receive a structured workout, and use it at the gym on their phone
**Verified:** 2026-02-21T22:15:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can type a message, send it, and see a streaming AI response appear word-by-word | VERIFIED | `useChat.ts` POSTs to `/api/chat/send`, reads `res.body.getReader()`, appends chunks via SSE `data.type === 'chunk'`. Server uses `streamSSE` + `chat.sendMessageStream()` |
| 2 | Chat messages persist across page refresh (stored in database) | VERIFIED | `chat.ts` inserts both user and model messages after each stream completes (`db.insert(messages)`). `useChat` calls `GET /api/chat/history` on mount via `useEffect` |
| 3 | AI coach has access to coaching profile and recent workouts in its system prompt | VERIFIED | `buildSystemPrompt()` in `coaching.ts` queries `coachingProfiles.findFirst()` and `workouts.findMany({limit:5, with:{exercises:{with:{sets:true}}}})`. Called on every `/send` and `/generate-workout` request |
| 4 | User can generate a structured workout via explicit action and it saves to the database | VERIFIED | `POST /api/chat/generate-workout` uses Gemini structured output with Zod schema + `z.toJSONSchema()`, validates with `validateWorkoutWeights()`, inserts workout/exercises/sets in a transaction |
| 5 | Today's workout displays exercises with sets, reps, weights, and rest times; rest timer counts down between sets | VERIFIED | `WorkoutView.tsx` fetches `GET /api/workouts` then `GET /api/workouts/:id`. `ExerciseCard` renders per-set `SetRow` with reps/weight/Done button. `RestTimer` uses `useRestTimer` with drift-corrected `endTimeRef` at 250ms interval |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Min Lines | Actual Lines | Substantive | Wired | Status |
|----------|-----------|--------------|-------------|-------|--------|
| `src/server/db/schema.ts` | 5 | 81 | Yes — messages, coachingProfiles tables + restSeconds column all present | Imported by coaching.ts, chat.ts, profile.ts | VERIFIED |
| `src/server/lib/coaching.ts` | 10 | 103 | Yes — exports `buildSystemPrompt`, `messagesToHistory`, `formatWorkoutForContext` | Imported and called in `chat.ts` lines 9, 37, 124 | VERIFIED |
| `src/server/lib/guardrails.ts` | 10 | 123 | Yes — exports `validateWorkoutWeights` with fuzzy match logic | Imported and called in `chat.ts` lines 12, 141 | VERIFIED |
| `src/server/routes/chat.ts` | 10 | 227 | Yes — POST /send (SSE), POST /generate-workout, GET /history all implemented | Mounted at `/api/chat` in `index.ts` line 18 | VERIFIED |
| `src/server/routes/profile.ts` | 10 | 90 | Yes — GET / and PUT / with upsert logic | Mounted at `/api/profile` in `index.ts` line 19 | VERIFIED |
| `src/client/hooks/useChat.ts` | 10 | 224 | Yes — `sendMessage` with ReadableStream SSE consumer, `generateWorkout`, `loadHistory` in useEffect | Used in `Chat.tsx` line 10 | VERIFIED |
| `src/client/components/Chat.tsx` | 15 | 99 | Yes — message list, input bar, Generate Workout button, auto-scroll | Rendered in `App.tsx` line 44 | VERIFIED |
| `src/client/styles/global.css` | 15 | 693 | Yes — full dark theme with CSS custom properties, 100dvh, 48px tap targets, timer styles | Imported in `main.tsx` line 3 | VERIFIED |
| `src/client/components/WorkoutView.tsx` | 50 | 170 | Yes — fetches API, renders ExerciseCard list, exercise nav, empty state | Rendered in `App.tsx` line 47 | VERIFIED |
| `src/client/components/ExerciseCard.tsx` | 30 | 62 | Yes — exercise name, summary line, per-set SetRow, rest seconds display | Used by WorkoutView line 130 | VERIFIED |
| `src/client/components/SetRow.tsx` | 20 | 34 | Yes — set number, reps, weight, RPE, Done button with completion state | Used by ExerciseCard line 48 | VERIFIED |
| `src/client/components/RestTimer.tsx` | 30 | 61 | Yes — countdown display, color transitions, Skip button, auto-starts on mount | Rendered in `App.tsx` line 57 as overlay | VERIFIED |
| `src/client/hooks/useRestTimer.ts` | 10 | 48 | Yes — drift-corrected via `endTimeRef`, 250ms interval, `start`/`stop` exported | Used in `RestTimer.tsx` line 10 | VERIFIED |
| `src/client/hooks/useWakeLock.ts` | 10 | 62 | Yes — `request`/`release` exported, `visibilitychange` re-acquire, graceful fallback | Used in `App.tsx` line 6, activated on workout tab | VERIFIED |
| `src/client/components/ProfileEditor.tsx` | 40 | 322 | Yes — fetches `GET /api/profile` on mount, PUTs on save, all 5 field categories present | Rendered in `App.tsx` line 52 | VERIFIED |

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `useChat.ts` | `/api/chat/send` | `fetch POST + res.body.getReader()` SSE consumer | WIRED | Line 88: `fetch('/api/chat/send', {method:'POST',...})` + line 99: `res.body.getReader()` |
| `chat.ts` (route) | `coaching.ts` | `buildSystemPrompt()` called before Gemini chat | WIRED | Lines 37 and 124: `await buildSystemPrompt()` called in both `/send` and `/generate-workout` |
| `chat.ts` (route) | `messages` table | `db.insert(messages)` after each exchange | WIRED | Line 72: insert after streaming; line 190: insert after workout generation |
| `Chat.tsx` | `useChat.ts` | Hook provides messages, sendMessage, isStreaming | WIRED | Line 10: `const { messages, sendMessage, generateWorkout, isStreaming } = useChat()` |
| `WorkoutView.tsx` | `/api/workouts` | `fetch GET` to load workout | WIRED | Line 50: `fetch('/api/workouts')`, line 62: `fetch('/api/workouts/${targetId}')` |
| `RestTimer.tsx` | `useRestTimer.ts` | Hook provides remaining, start, stop | WIRED | Line 10: `const { remaining, isRunning, start, stop } = useRestTimer({onComplete})` |
| `WorkoutView.tsx` | `useWakeLock.ts` | Wake lock activated when Workout tab active | WIRED | `App.tsx` line 17-23: useEffect triggers `requestWakeLock()` when `activeTab === 'workout'` |
| `App.tsx` | `WorkoutView.tsx` | Workout tab renders WorkoutView | WIRED | Line 47: `<WorkoutView workoutId={latestWorkoutId} onStartRest={handleStartRest} />` |
| `guardrails.ts` | `chat.ts` (route) | `validateWorkoutWeights()` called with profile maxes | WIRED | Line 141: `const warnings = validateWorkoutWeights(plan.exercises..., maxes)` |
| `ProfileEditor.tsx` | `/api/profile` | GET on mount, PUT on save | WIRED | Lines 51 (GET) and 73 (PUT with full profile payload) |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| COACH-01 | Chat interface for conversational coaching with Gemini API | SATISFIED | `Chat.tsx` + `useChat.ts` + `chat.ts` POST /send with Gemini `sendMessageStream` |
| COACH-02 | AI generates structured workout plans | SATISFIED | POST /api/chat/generate-workout with Zod schema, `responseMimeType: 'application/json'` |
| COACH-03 | Coaching profile always in context | SATISFIED | `buildSystemPrompt()` loads profile + last 5 workouts on every AI call |
| COACH-04 | Output guardrails — validate weights against known ranges | SATISFIED | `validateWorkoutWeights()` in `guardrails.ts` checks 20-120% of known max, called in generate-workout |
| COACH-05 | System prompt calibrated to coaching style | SATISFIED | `coaching.ts` builds multi-section system prompt with persona, profile data, workout history, and guidelines |
| COACH-06 | Freeform text feedback on completed workouts | SATISFIED | POST `/api/workouts/:id/log` uses Gemini structured output to parse natural language into exercise/set data |
| UI-01 | Today's workout view — exercises, sets, reps, rest times, weights | SATISFIED | `WorkoutView.tsx` → `ExerciseCard.tsx` → `SetRow.tsx` renders all fields from API |
| UI-02 | Workout logging — log completed sets via freeform text | SATISFIED | `/api/workouts/:id/log` endpoint parses freeform text into structured data with Gemini |
| UI-04 | Rest timer — countdown between sets | SATISFIED | `RestTimer.tsx` + `useRestTimer.ts` with drift-corrected absolute-time countdown |
| UI-05 | Mobile-first responsive design for gym use | SATISFIED | `global.css`: 100dvh, 48px tap targets on `button` global selector, dark theme, bottom tab bar |
| DIET-03 | Dietary constraints stored in coaching profile | SATISFIED | `coachingProfiles.dietaryConstraints` column in schema; editable in `ProfileEditor.tsx`; included in system prompt |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `RestTimer.tsx` | 43 | `return null` | Info | Correct usage — component hides itself when timer is not running and remaining is 0 |
| `ChatMessage.tsx` | 13 | `return null` | Info | Correct usage — guard against empty text render, not a stub |
| `guardrails.ts` | 82 | `return null` | Info | Correct usage — signals "unknown exercise, skip validation" |
| `useChat.ts` | 215 | `return null` | Info | Correct usage — error path returns null from generateWorkout |
| `Chat.tsx` | 83 | `placeholder` attribute | Info | HTML input placeholder text, not implementation stub |

No blocker anti-patterns found. All `return null` instances are legitimate guards or error returns, not empty stub implementations. No TODO, FIXME, or "coming soon" comments exist in any source file.

### Human Verification Required

The following items require a running browser session to confirm. All structural preconditions are verified — these tests confirm user-facing behavior.

#### 1. Streaming Response Visual Behavior

**Test:** Start the dev servers, open the chat interface, type a message and press Enter.
**Expected:** AI response text appears progressively as individual words/tokens arrive (visible character-by-character or word-by-word build-up), not as a single block appearing all at once after a pause.
**Why human:** The SSE wiring is structurally complete (streamSSE on server, getReader on client, chunk events appended to state), but the actual visual streaming behavior depends on Gemini's response cadence and the browser's rendering — requires a live session to confirm.

#### 2. Rest Timer Countdown and Overlay Dismiss

**Test:** Generate a workout, switch to the Workout tab, tap the "Done" button on any set.
**Expected:** A full-screen dark overlay appears with a large countdown number (starts at the exercise's restSeconds value, e.g. 90). The number decreases smoothly (updating approximately 4 times per second). When it reaches 0 the overlay disappears. The "Skip" button dismisses it early.
**Why human:** Timer rendering and dismiss behavior require a running React app to observe. The drift-correction logic (endTimeRef) is verified structurally but actual countdown accuracy needs real-time observation.

#### 3. Mobile Usability at the Gym

**Test:** Open http://localhost:5173 in a browser set to mobile viewport (375px width, iPhone SE) or on an actual phone. Navigate all three tabs (Chat, Workout, Profile).
**Expected:** Text is readable without zooming (minimum 16px), all buttons are large enough to tap without precision (minimum 48px height), the bottom tab bar is thumb-reachable, dark background is comfortable in a gym environment, no horizontal scrolling.
**Why human:** CSS tap target sizes and layout are structurally set to 48px via CSS custom property (`--tap-target: 48px`), but physical usability and readability at arm's length require a real device or accurate mobile simulation.

## Gaps Summary

No gaps found. All five observable truths are fully verified across all three levels (exists, substantive, wired). The complete AI coaching loop is implemented end-to-end:

- Server: Gemini SSE streaming, structured workout generation with JSON schema validation, weight guardrails, coaching profile CRUD, freeform text logging, and chat history persistence are all real, non-stub implementations.
- Client: Chat interface with SSE consumer hook, workout view with exercise/set hierarchy, drift-corrected rest timer, wake lock, profile editor, and three-tab navigation are all connected and substantive.
- CSS: Mobile-first dark theme with 100dvh, 48px tap targets system-wide, 64px timer font, and tabular-nums digit stabilization are all present and correctly structured.

Three human verification items remain (streaming visual behavior, timer countdown observation, mobile ergonomics) but these test user experience quality, not structural completeness. The codebase fully supports the phase goal.

---

_Verified: 2026-02-21T22:15:00Z_
_Verifier: Claude (gsd-verifier)_
