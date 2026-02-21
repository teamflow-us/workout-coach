# Phase 2: AI Coaching Loop - Research

**Researched:** 2026-02-21
**Domain:** Gemini Chat API (streaming + structured output), Hono SSE streaming, React chat UI, mobile-first gym UX, rest timer
**Confidence:** HIGH (core patterns verified via official docs and SDK samples)

## Summary

Phase 2 transforms the Phase 1 skeleton into a working AI coaching app. The core challenge is bridging two modes of Gemini output: (1) streaming conversational text for the chat interface, and (2) structured JSON for generating workout plans that can be stored in the database and rendered in a workout view. The `@google/genai` SDK supports both modes, including combining streaming with structured output (streaming JSON).

The standard approach uses Hono's `streamSSE` helper to forward Gemini `generateContentStream` / `chat.sendMessageStream` chunks as Server-Sent Events to the React client. The React client uses `fetch` with `ReadableStream` (not `EventSource`, since we need POST bodies for chat messages) to consume the stream and progressively render text. For structured workout generation, Gemini's `responseMimeType: 'application/json'` with `responseJsonSchema` (produced by Zod v4's native `z.toJSONSchema()`) returns validated workout JSON that gets stored via the existing Drizzle schema.

The mobile-first gym UX requires: minimum 44x44px tap targets, the Screen Wake Lock API to prevent screen sleep during workouts, a rest timer using `setInterval` with drift correction, and a viewport-aware layout that prioritizes the current set information. No CSS framework is strictly needed -- CSS custom properties with a mobile-first media query strategy suffices for a single-user app.

**Primary recommendation:** Use a dual-mode approach: streaming chat for conversation, non-streaming structured output for workout generation. Store conversation history in a new `messages` table. Add `restSeconds` to the exercises table. Keep the coaching profile as a JSON blob in a `coaching_profiles` table.

## Standard Stack

### Core (already installed from Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | ^1.42.0 | Gemini chat, streaming, structured output | Already installed. Provides `ai.chats.create()`, `generateContentStream`, structured JSON mode |
| `hono` | ^4.12.1 | Backend API with SSE streaming | Already installed. Has `streamSSE` helper in `hono/streaming` |
| `drizzle-orm` | ^0.45.1 | Database queries for new tables | Already installed. Add `messages`, `coaching_profiles` tables |
| `zod` | ^4.3.6 | Schema validation + JSON Schema generation | Already installed. Use `z.toJSONSchema()` (native Zod v4), NOT `zodToJsonSchema()` |
| `react` | ^19.2.4 | Chat UI, workout view, timer components | Already installed. No additional React libraries needed |

### New (Phase 2 additions)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | - | The existing stack covers all Phase 2 needs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw CSS | Tailwind CSS | Tailwind speeds up styling but adds build complexity; for a single-user app with few screens, raw CSS is faster to ship |
| fetch + ReadableStream | EventSource API | EventSource only supports GET; chat requires POST with message body. Use fetch. |
| setInterval timer | requestAnimationFrame timer | rAF pauses when tab is backgrounded (bad for gym use); setInterval continues. Use setInterval with drift correction. |
| Custom chat UI | Vercel AI SDK / @ai-sdk/react | AI SDK adds abstractions for streaming hooks; but this project uses Hono (not Next.js) and Gemini directly, so the SDK adds unnecessary coupling |

**Installation:**
```bash
# No new packages needed for Phase 2
# Everything is already installed from Phase 1
```

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)
```
src/
├── server/
│   ├── routes/
│   │   ├── chat.ts              # POST /api/chat (streaming SSE)
│   │   ├── workouts.ts          # Existing + PATCH for logging
│   │   └── profile.ts           # GET/PUT /api/profile (coaching profile)
│   ├── lib/
│   │   ├── gemini.ts            # Existing client
│   │   ├── coaching.ts          # System prompt builder, profile context assembly
│   │   └── guardrails.ts        # Weight/rep validation against known ranges
│   └── db/
│       └── schema.ts            # Add messages, coaching_profiles tables
├── client/
│   ├── components/
│   │   ├── Chat.tsx             # Chat message list + input
│   │   ├── ChatMessage.tsx      # Single message bubble (user vs AI)
│   │   ├── WorkoutView.tsx      # Today's workout display
│   │   ├── ExerciseCard.tsx     # Single exercise with sets
│   │   ├── SetRow.tsx           # Individual set row (reps, weight, status)
│   │   ├── RestTimer.tsx        # Countdown timer between sets
│   │   └── ProfileEditor.tsx    # Edit coaching profile
│   ├── hooks/
│   │   ├── useChat.ts           # SSE streaming hook for chat
│   │   ├── useWakeLock.ts       # Screen Wake Lock during workouts
│   │   └── useRestTimer.ts      # Timer countdown logic
│   ├── App.tsx                  # Route between chat and workout views
│   └── styles/
│       └── global.css           # Mobile-first CSS variables and base styles
```

### Pattern 1: Hono SSE Streaming Gemini Responses
**What:** Backend route that creates a Gemini chat, streams the response as SSE events to the client
**When to use:** Every chat message exchange

```typescript
// Source: https://hono.dev/docs/helpers/streaming + https://ai.google.dev/gemini-api/docs/text-generation
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { ai } from '../lib/gemini.js'
import { buildSystemPrompt } from '../lib/coaching.js'

const app = new Hono()

app.post('/send', async (c) => {
  const { message, history } = await c.req.json()
  const systemPrompt = await buildSystemPrompt() // includes coaching profile

  return streamSSE(c, async (stream) => {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemPrompt,
      },
      history: history, // prior turns as Content[]
    })

    const response = await chat.sendMessageStream({ message })

    let fullText = ''
    for await (const chunk of response) {
      const text = chunk.text
      if (text) {
        fullText += text
        await stream.writeSSE({
          data: JSON.stringify({ type: 'chunk', text }),
          event: 'message',
        })
      }
    }

    // Signal completion with full text
    await stream.writeSSE({
      data: JSON.stringify({ type: 'done', fullText }),
      event: 'message',
    })
  })
})
```

### Pattern 2: Structured Workout Generation (Non-Streaming)
**What:** Separate endpoint that generates a structured workout plan as JSON
**When to use:** When user asks for a new workout or the AI decides to prescribe one

```typescript
// Source: https://ai.google.dev/gemini-api/docs/structured-output
import { z } from 'zod'

const workoutPlanSchema = z.object({
  programName: z.string().describe('Name of the workout program, e.g. "Push Day A"'),
  exercises: z.array(z.object({
    name: z.string().describe('Exercise name, e.g. "Barbell Bench Press"'),
    sets: z.number().int().describe('Number of sets'),
    reps: z.number().int().describe('Target reps per set'),
    weight: z.number().describe('Weight in lbs'),
    restSeconds: z.number().int().describe('Rest between sets in seconds'),
    notes: z.string().optional().describe('Form cues or modifications'),
  })),
  notes: z.string().optional().describe('General workout notes'),
})

app.post('/generate-workout', async (c) => {
  const { prompt, profile } = await c.req.json()
  const systemPrompt = await buildSystemPrompt()

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseJsonSchema: z.toJSONSchema(workoutPlanSchema),
    },
  })

  const plan = workoutPlanSchema.parse(JSON.parse(response.text!))
  // Validate weights against known ranges (guardrails)
  // Store in database via existing workout CRUD
  return c.json(plan)
})
```

### Pattern 3: React Streaming Chat with fetch + ReadableStream
**What:** Client-side hook that POSTs to the chat endpoint and reads the SSE stream
**When to use:** Every chat interaction

```typescript
// Source: Verified pattern from multiple React SSE guides (2025-2026)
function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = async (text: string) => {
    // Add user message immediately
    const userMsg = { role: 'user' as const, text, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)

    // Add placeholder for AI response
    const aiMsg = { role: 'model' as const, text: '', timestamp: Date.now() }
    setMessages(prev => [...prev, aiMsg])

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: buildHistory(messages) }),
        signal: abortRef.current.signal,
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const event of events) {
          const dataLine = event.split('\n').find(l => l.startsWith('data: '))
          if (!dataLine) continue
          const data = JSON.parse(dataLine.slice(6))

          if (data.type === 'chunk') {
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              updated[updated.length - 1] = { ...last, text: last.text + data.text }
              return updated
            })
          }
        }
      }
    } finally {
      setIsStreaming(false)
    }
  }

  return { messages, sendMessage, isStreaming }
}
```

### Pattern 4: Rest Timer with Drift Correction
**What:** Countdown timer that stays accurate even when browser throttles setInterval
**When to use:** Between sets during active workout

```typescript
// Source: MDN + community best practices for accurate timers
function useRestTimer(onComplete: () => void) {
  const [remaining, setRemaining] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const endTimeRef = useRef(0)

  const start = (seconds: number) => {
    endTimeRef.current = Date.now() + seconds * 1000
    setRemaining(seconds)
    setIsRunning(true)
  }

  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      const now = Date.now()
      const left = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000))
      setRemaining(left)
      if (left <= 0) {
        clearInterval(interval)
        setIsRunning(false)
        onComplete()
      }
    }, 250) // Update 4x/sec for smooth display, drift-corrected via endTime

    return () => clearInterval(interval)
  }, [isRunning, onComplete])

  return { remaining, isRunning, start, stop: () => setIsRunning(false) }
}
```

### Pattern 5: Screen Wake Lock for Gym Use
**What:** Prevents phone screen from sleeping during active workout
**When to use:** While workout view is active

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const request = async () => {
    if (!('wakeLock' in navigator)) return
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
    } catch (err) {
      console.warn('Wake Lock request failed:', err)
    }
  }

  const release = async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release()
      wakeLockRef.current = null
    }
  }

  // Re-acquire on tab visibility change
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible' && wakeLockRef.current === null) {
        await request()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  return { request, release }
}
```

### Anti-Patterns to Avoid
- **Streaming structured JSON to the client:** Don't stream partial JSON and try to parse it incrementally. Use streaming for conversational text only. Use non-streaming `generateContent` with `responseMimeType: 'application/json'` for structured workout plans.
- **Using EventSource API for chat:** EventSource only supports GET requests. Chat requires POST with message body and history. Use `fetch` with `ReadableStream` instead.
- **Using zodToJsonSchema() with Zod v4:** The `zod-to-json-schema` package is broken with Zod v4 (confirmed in Phase 1 research). Use `z.toJSONSchema()` which is native to Zod v4.
- **Putting conversation history in the URL/query params:** History can be large. Always POST it in the request body.
- **Building the system prompt on the client:** The system prompt contains coaching profile data and should be assembled server-side. The client sends messages; the server adds context.
- **Using requestAnimationFrame for the rest timer:** rAF pauses when the browser tab is backgrounded (common at the gym when switching apps). Use setInterval with drift correction via absolute timestamps.

## Schema Changes Required

Phase 2 needs three additions to the existing database schema:

### New Tables

```typescript
// Messages table - stores chat conversation history
export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  role: text('role').notNull(), // 'user' | 'model'
  content: text('content').notNull(),
  workoutId: integer('workout_id').references(() => workouts.id), // nullable - linked if workout was generated
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

// Coaching profile - single row, stores user's training context
export const coachingProfiles = sqliteTable('coaching_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  maxes: text('maxes').notNull().default('{}'),           // JSON: { "bench": 225, "squat": 315, ... }
  injuries: text('injuries').notNull().default('[]'),      // JSON: ["left shoulder impingement"]
  equipment: text('equipment').notNull().default('[]'),    // JSON: ["barbell", "dumbbells", "cable machine"]
  dietaryConstraints: text('dietary_constraints').notNull().default('[]'), // JSON: ["gluten-free"]
  preferences: text('preferences').notNull().default('{}'), // JSON: { "daysPerWeek": 4, "sessionMinutes": 60 }
  updatedAt: text('updated_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
})
```

### Existing Table Modifications

```typescript
// Add restSeconds to exercises table (rest time per exercise, not per set)
export const exercises = sqliteTable('exercises', {
  // ... existing fields ...
  restSeconds: integer('rest_seconds'), // nullable - rest between sets in seconds
})
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE streaming | Manual `Transfer-Encoding: chunked` + header management | `streamSSE` from `hono/streaming` | Handles headers, connection lifecycle, abort cleanup |
| JSON Schema from Zod | Manual JSON Schema objects or `zodToJsonSchema()` | `z.toJSONSchema()` (Zod v4 native) | zodToJsonSchema is broken with Zod v4; native method works correctly |
| Chat history management | Manual array of messages passed every call | `ai.chats.create()` with `history` param + `sendMessageStream` | SDK manages turn format, token counting, history concatenation |
| Screen wake lock | Periodic user interaction simulation | `navigator.wakeLock.request('screen')` | Standard API, supported all major browsers, proper lifecycle |
| Timer drift correction | Naive `setInterval(fn, 1000)` | setInterval with absolute end-time comparison | setInterval drifts; comparing against `Date.now()` stays accurate |
| Workout weight validation | Trust LLM output directly | Zod `.refine()` + range checking against profile maxes | LLMs hallucinate numbers; validate generated weights are within 20-120% of known maxes |

**Key insight:** The Gemini SDK's chat module (`ai.chats.create()`) handles the complexity of multi-turn conversation state, including properly formatting history as `Content[]` objects with `role` and `parts`. Don't manually construct the conversation format -- let the SDK do it.

## Common Pitfalls

### Pitfall 1: Streaming + Structured Output Confusion
**What goes wrong:** Trying to combine `generateContentStream` with `responseMimeType: 'application/json'` and parsing partial JSON chunks.
**Why it happens:** Streaming structured output IS supported by Gemini, but the chunks are partial JSON that can't be parsed until complete. The client receives fragments like `{"exercises":[{"name":"Ben` which are not valid JSON.
**How to avoid:** Use two separate code paths: (1) Streaming text for conversational chat messages (no schema constraint). (2) Non-streaming `generateContent` with JSON schema for workout plan generation. The workout generation is fast enough without streaming since it's a single structured response.
**Warning signs:** JSON parse errors in the client, incomplete workout data.

### Pitfall 2: System Prompt Grows Unbounded
**What goes wrong:** The system prompt includes the entire coaching profile, all recent workouts, and full conversation context, eventually exceeding useful limits.
**Why it happens:** Phase 2 uses context stuffing. As more workouts accumulate, the system prompt grows.
**How to avoid:** Cap the system prompt to a reasonable size: coaching profile (small, ~500 tokens), last 5-10 workouts with full detail (~2-5K tokens), and a summary of older history. Total system prompt should stay under 10K tokens. Phase 3's RAG will properly handle the full history.
**Warning signs:** Slow response times, degraded coaching quality, high API costs.

### Pitfall 3: Lost Conversation on Page Refresh
**What goes wrong:** User refreshes the page and loses the entire chat conversation.
**Why it happens:** Chat state stored only in React state (memory).
**How to avoid:** Persist messages to the `messages` table on every exchange. Load recent conversation from the database on page load. This also gives you the history needed for `ai.chats.create()`.
**Warning signs:** Users losing context, AI repeating itself after refresh.

### Pitfall 4: Rest Timer Stops When Phone Sleeps
**What goes wrong:** The countdown timer freezes when the phone screen turns off or the browser is backgrounded.
**Why it happens:** Mobile browsers throttle JavaScript timers aggressively when backgrounded.
**How to avoid:** (1) Use Screen Wake Lock API to prevent screen sleep during active workout. (2) Use absolute end-time comparison (not decrement-based counting) so the timer "catches up" when the tab regains focus. (3) Consider a simple audio beep or vibration on completion using the Web Audio API or Vibration API.
**Warning signs:** Timer showing wrong time after unlocking phone, missed rest periods.

### Pitfall 5: Gemini Hallucinates Unreasonable Weights
**What goes wrong:** AI prescribes 500lb squats for someone with a 275lb max, or 5lb bench press for an experienced lifter.
**Why it happens:** LLMs sometimes generate plausible-looking but incorrect numbers, especially for weights and reps.
**How to avoid:** Implement output guardrails: compare every generated weight against the user's known maxes from the coaching profile. Flag anything outside 20-120% of known max for that exercise category. Use Zod `.refine()` for basic bounds, and a post-generation validation step for profile-aware checks.
**Warning signs:** Weights that seem extreme, user complaints about incorrect programming.

### Pitfall 6: Mobile Keyboard Pushes Chat Input Off Screen
**What goes wrong:** On mobile, the virtual keyboard opens and pushes the chat input below the visible area, or the message list scrolls to the wrong position.
**Why it happens:** Mobile browsers handle viewport resizing differently. `100vh` includes the area behind the keyboard on some browsers.
**How to avoid:** Use `100dvh` (dynamic viewport height) instead of `100vh`. Use `position: fixed` or `position: sticky` for the input bar at the bottom. Listen for `visualViewport.resize` events to adjust layout. Test on actual phones.
**Warning signs:** Chat input disappearing when keyboard opens, layout jumps.

## Code Examples

### System Prompt Builder
```typescript
// src/server/lib/coaching.ts
import { db } from '../db/index.js'
import { coachingProfiles, workouts, exercises, sets } from '../db/schema.js'
import { desc, eq } from 'drizzle-orm'

export async function buildSystemPrompt(): Promise<string> {
  // Load coaching profile
  const profile = await db.query.coachingProfiles.findFirst()

  // Load recent workouts (last 5 with full detail)
  const recentWorkouts = await db.query.workouts.findMany({
    orderBy: [desc(workouts.date)],
    limit: 5,
    with: {
      exercises: {
        with: { sets: true },
      },
    },
  })

  return `You are an experienced strength and conditioning coach. You have been coaching this user for months and know their training history intimately.

## Coaching Profile
- Current maxes: ${JSON.stringify(profile?.maxes || {})}
- Injuries/limitations: ${JSON.stringify(profile?.injuries || [])}
- Available equipment: ${JSON.stringify(profile?.equipment || [])}
- Dietary constraints: ${JSON.stringify(profile?.dietaryConstraints || [])}
- Training preferences: ${JSON.stringify(profile?.preferences || {})}

## Recent Workouts
${recentWorkouts.map(w => formatWorkoutForContext(w)).join('\n\n')}

## Guidelines
- Generate workout plans as structured data when asked
- Adjust weights and volume based on the user's feedback and known maxes
- Never prescribe weight above 120% of a known max without explicit discussion
- Be encouraging but data-driven
- Reference specific past workouts when relevant
- If the user reports pain or injury, immediately modify the program to avoid aggravation`
}

function formatWorkoutForContext(workout: any): string {
  const exerciseLines = workout.exercises.map((ex: any) => {
    const setLines = ex.sets.map((s: any) =>
      `  Set ${s.setNumber}: ${s.reps} reps @ ${s.weight}lbs${s.rpe ? ` RPE ${s.rpe}` : ''}`
    ).join('\n')
    return `- ${ex.name}\n${setLines}`
  }).join('\n')

  return `### ${workout.date} - ${workout.programName || 'Workout'}
${workout.feedback ? `Feedback: ${workout.feedback}` : ''}
${exerciseLines}`
}
```

### Weight Guardrail Validation
```typescript
// src/server/lib/guardrails.ts
import { z } from 'zod'

interface KnownMaxes {
  [exercise: string]: number // exercise name -> max weight in lbs
}

// Exercise category mapping for fuzzy matching
const EXERCISE_CATEGORIES: Record<string, string[]> = {
  bench: ['bench press', 'incline bench', 'decline bench', 'dumbbell bench'],
  squat: ['back squat', 'front squat', 'goblet squat'],
  deadlift: ['deadlift', 'sumo deadlift', 'romanian deadlift', 'rdl'],
  overhead: ['overhead press', 'military press', 'shoulder press'],
  row: ['barbell row', 'dumbbell row', 'cable row', 'bent over row'],
}

function findMaxForExercise(exerciseName: string, maxes: KnownMaxes): number | null {
  const lower = exerciseName.toLowerCase()

  // Direct match
  if (maxes[lower]) return maxes[lower]

  // Category match
  for (const [category, variants] of Object.entries(EXERCISE_CATEGORIES)) {
    if (variants.some(v => lower.includes(v) || v.includes(lower))) {
      if (maxes[category]) return maxes[category]
    }
  }

  return null // unknown exercise
}

export function validateWorkoutWeights(
  exercises: Array<{ name: string; weight: number }>,
  maxes: KnownMaxes
): Array<{ exercise: string; weight: number; max: number; issue: string }> {
  const issues: Array<{ exercise: string; weight: number; max: number; issue: string }> = []

  for (const ex of exercises) {
    const knownMax = findMaxForExercise(ex.name, maxes)
    if (knownMax === null) continue // can't validate unknown exercises

    if (ex.weight > knownMax * 1.2) {
      issues.push({
        exercise: ex.name,
        weight: ex.weight,
        max: knownMax,
        issue: `Weight ${ex.weight}lbs exceeds 120% of known max (${knownMax}lbs)`,
      })
    }

    if (ex.weight < knownMax * 0.2 && ex.weight > 0) {
      issues.push({
        exercise: ex.name,
        weight: ex.weight,
        max: knownMax,
        issue: `Weight ${ex.weight}lbs is below 20% of known max (${knownMax}lbs) -- suspiciously low`,
      })
    }
  }

  return issues
}
```

### Mobile-First CSS Base
```css
/* src/client/styles/global.css */

/* Mobile-first variables */
:root {
  --color-bg: #0a0a0a;
  --color-surface: #1a1a1a;
  --color-surface-elevated: #2a2a2a;
  --color-text: #f0f0f0;
  --color-text-muted: #888;
  --color-accent: #4a9eff;
  --color-success: #4caf50;
  --color-warning: #ff9800;
  --color-danger: #f44336;

  --tap-target: 48px;      /* Minimum 48px for gym gloves */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  --font-size-sm: 14px;
  --font-size-md: 16px;    /* Minimum for mobile readability */
  --font-size-lg: 20px;
  --font-size-xl: 28px;
  --font-size-timer: 64px; /* Rest timer display */

  --radius: 12px;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: var(--font-size-md);
  background: var(--color-bg);
  color: var(--color-text);
  -webkit-text-size-adjust: 100%;
}

/* Chat layout - full height minus input */
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100dvh; /* Dynamic viewport height - accounts for mobile keyboard */
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  -webkit-overflow-scrolling: touch;
}

.chat-input-bar {
  position: sticky;
  bottom: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border-top: 1px solid var(--color-surface-elevated);
}

/* Tap targets - minimum 48px for gym use with gloves */
button, .tap-target {
  min-height: var(--tap-target);
  min-width: var(--tap-target);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-md);
  border-radius: var(--radius);
  border: none;
  cursor: pointer;
  touch-action: manipulation; /* Prevent double-tap zoom */
}

/* Rest timer - large, centered, readable at arm's length */
.rest-timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-timer);
  font-variant-numeric: tabular-nums; /* Fixed-width digits prevent layout shift */
  font-weight: 700;
  padding: var(--spacing-xl);
}

/* Desktop enhancement (mobile-first: styles above are the base) */
@media (min-width: 768px) {
  .app-layout {
    display: grid;
    grid-template-columns: 400px 1fr;
    max-width: 1200px;
    margin: 0 auto;
  }
}
```

### Freeform Text Set Logging
```typescript
// POST /api/workouts/:id/log
// User sends freeform text like "bench 3x8 at 185, felt easy"
// Server parses with Gemini and updates the workout

app.post('/:id/log', async (c) => {
  const workoutId = Number(c.req.param('id'))
  const { text } = await c.req.json()

  const logSchema = z.object({
    exercises: z.array(z.object({
      name: z.string(),
      sets: z.array(z.object({
        setNumber: z.number().int(),
        reps: z.number().int(),
        weight: z.number(),
        rpe: z.number().min(1).max(10).optional(),
      })),
    })),
    feedback: z.string().optional(),
  })

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Parse this workout log into structured data. The user said: "${text}"`,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: z.toJSONSchema(logSchema),
    },
  })

  const parsed = logSchema.parse(JSON.parse(response.text!))
  // Store parsed sets in database...
  return c.json(parsed)
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `zodToJsonSchema()` third-party | `z.toJSONSchema()` native Zod v4 | June 2025 (Zod v4 release) | Third-party package abandoned; native method required |
| `@google/generative-ai` SDK | `@google/genai` SDK | Nov 2025 (EOL) | New SDK has `ai.chats.create()`, unified streaming API |
| 100vh for mobile full-height | 100dvh (dynamic viewport height) | 2023+ browser support | Accounts for mobile browser chrome and virtual keyboard |
| EventSource for SSE | fetch + ReadableStream | When POST bodies are needed | EventSource is GET-only; chat requires POST |
| `setInterval(fn, 1000)` timers | setInterval with absolute end-time drift correction | Best practice (always) | Prevents drift accumulation over multi-minute rest periods |
| Old Gemini model `gemini-1.5-flash` | `gemini-2.5-flash` | 2025 | Better structured output, cheaper, 1M context window |

**Deprecated/outdated:**
- `zodToJsonSchema()`: Package abandoned as of Nov 2025. Use `z.toJSONSchema()`.
- `@google/generative-ai`: End-of-life. Already using `@google/genai` from Phase 1.
- `100vh` on mobile: Unreliable with mobile keyboards. Use `100dvh`.

## Open Questions

1. **Chat history vs. Gemini SDK history format**
   - What we know: `ai.chats.create()` expects `history` as `Content[]` where each entry has `role: 'user' | 'model'` and `parts: [{ text: string }]`. Our DB stores messages with `role` and `content` as flat text.
   - What's unclear: Whether the SDK's `Content[]` format exactly matches what we store, or if there's a transformation needed.
   - Recommendation: Build a simple `messagesToHistory()` converter that maps DB messages to SDK format. This is straightforward.

2. **Dual-mode AI response (chat vs. workout generation)**
   - What we know: Chat uses streaming text, workout generation uses structured JSON. These are two separate Gemini calls.
   - What's unclear: Whether the AI should decide when to generate a workout (agentic) or the user should explicitly trigger it (button). The agentic approach requires detecting "workout generation intent" in the conversation.
   - Recommendation: Start with explicit user action (a "Generate Workout" button in the chat). The AI's conversational response can suggest workouts, and the user clicks to generate. Simpler to implement, clearer UX.

3. **Coaching profile bootstrap**
   - What we know: COACH-03 requires the coaching profile (maxes, injuries, equipment) to always be in context.
   - What's unclear: How to initially populate this data. Phase 3 will have RAG from conversation history, but Phase 2 needs something.
   - Recommendation: Manual profile editor (simple form) where the user enters their current maxes, injuries, and equipment. This is the ProfileEditor component. Quick to build, immediately useful.

4. **Conversation scoping**
   - What we know: The chat is the main interface. Messages accumulate over time.
   - What's unclear: Whether to treat all messages as one continuous conversation, or scope conversations by day/session.
   - Recommendation: Scope by session. Start a new conversation context each day or when the user explicitly starts a new chat. Load the last N messages from the current session for history. The system prompt provides long-term context.

## Sources

### Primary (HIGH confidence)
- [Gemini Text Generation - Chat + Streaming](https://ai.google.dev/gemini-api/docs/text-generation) - `ai.chats.create()`, `sendMessageStream`, system instructions, history format
- [Gemini Structured Output](https://ai.google.dev/gemini-api/docs/structured-output) - `responseMimeType`, `responseJsonSchema`, Zod integration
- [Hono Streaming Helper](https://hono.dev/docs/helpers/streaming) - `streamSSE`, `stream`, `streamText` APIs with full code examples
- [Zod v4 JSON Schema](https://zod.dev/json-schema) - `z.toJSONSchema()` API, options, limitations
- [Screen Wake Lock API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) - Request/release, visibility change re-acquisition
- [js-genai streaming sample](https://github.com/googleapis/js-genai/blob/main/sdk-samples/generate_content_streaming.ts) - Official streaming code example
- [Gemini Models Reference](https://ai.google.dev/gemini-api/docs/models) - Current model names and capabilities

### Secondary (MEDIUM confidence)
- [Gemini Forum: Streaming + Structured Output](https://discuss.ai.google.dev/t/do-stream-responses-support-structured-output/79482) - Confirmed structured output works with streaming
- [Zod v4 + Gemini Structured Output Blog](https://www.buildwithmatija.com/blog/zod-v4-gemini-fix-structured-output-z-tojsonschema) - Detailed walkthrough of z.toJSONSchema() with Gemini
- [OneUptime SSE in React Guide (Jan 2026)](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view) - fetch + ReadableStream pattern, custom hooks, cleanup

### Tertiary (LOW confidence)
- WebSearch results on React mobile-first chat patterns - General guidance, not specific to this stack
- WebSearch results on gym workout timer patterns - Standard timer advice, not workout-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and verified in Phase 1; API patterns confirmed via official docs
- Architecture: HIGH - Streaming SSE pattern verified via Hono docs; Gemini chat API verified via official docs and SDK samples
- Schema changes: MEDIUM - Messages and coaching profile tables are standard patterns; exact field choices are recommendations
- Pitfalls: HIGH - Streaming+JSON confusion, mobile keyboard, timer drift are well-documented issues
- Guardrails: MEDIUM - Weight validation ranges (20-120% of max) are reasonable heuristics but may need tuning

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days - stack is stable, patterns are established)
