---
phase: 02-ai-coaching-loop
plan: 02
subsystem: ui
tags: [react, rest-timer, wake-lock, mobile, gym-ux, profile-editor, workout-view]

# Dependency graph
requires:
  - phase: 02-ai-coaching-loop/01
    provides: Chat UI, workout generation API, profile API, streaming SSE, mobile-first dark theme
provides:
  - Workout view with exercise cards and set rows
  - Drift-corrected rest timer with large gym display
  - Screen wake lock to prevent phone sleep during workout
  - Coaching profile editor (maxes, injuries, equipment, dietary constraints, preferences)
  - Three-tab navigation (Chat / Workout / Profile) with bottom tab bar
affects: [03-rag-pipeline, 04-progress-diet-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drift-corrected timer: absolute end time reference with 250ms interval (no accumulating drift)"
    - "Wake Lock API: request on tab focus, re-acquire on visibilitychange, graceful fallback"
    - "Gym-first component sizing: 64px timer font, 48px tap targets, tabular-nums for stable layout"
    - "Tab-based routing: bottom nav bar with fixed positioning, activeTab state in App.tsx"

key-files:
  created:
    - src/client/components/WorkoutView.tsx
    - src/client/components/ExerciseCard.tsx
    - src/client/components/SetRow.tsx
    - src/client/components/RestTimer.tsx
    - src/client/components/ProfileEditor.tsx
    - src/client/hooks/useRestTimer.ts
    - src/client/hooks/useWakeLock.ts
  modified:
    - src/client/App.tsx
    - src/client/components/Chat.tsx
    - src/client/styles/global.css

key-decisions:
  - "Three-tab bottom navigation pattern for mobile gym use (Chat / Workout / Profile)"
  - "Rest timer as overlay/modal with color transitions (green -> yellow -> red at <10s)"
  - "Wake lock activates on Workout tab, releases on tab switch"

patterns-established:
  - "Custom hook pattern: useRestTimer returns {remaining, isRunning, start, stop}"
  - "Custom hook pattern: useWakeLock returns {request, release} with visibilitychange re-acquire"
  - "Component hierarchy: WorkoutView -> ExerciseCard -> SetRow (callback propagation for rest timer)"

requirements-completed: [COACH-01, COACH-02, COACH-03, COACH-04, COACH-05, COACH-06, UI-01, UI-02, UI-04, UI-05, DIET-03]

# Metrics
duration: 12min
completed: 2026-02-21
---

# Phase 2 Plan 2: Workout View and Gym UX Summary

**Gym-ready workout display with exercise cards, drift-corrected rest timer, screen wake lock, coaching profile editor, and three-tab mobile navigation**

## Performance

- **Duration:** ~12 min (across two execution segments with checkpoint pause)
- **Started:** 2026-02-21T21:44:55Z
- **Completed:** 2026-02-21T21:56:44Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 10

## Accomplishments
- Today's workout view loads most recent workout from API and displays exercises with sets, reps, weights, and rest times
- Drift-corrected rest timer counts down between sets using absolute end time reference (no accumulating error)
- Screen wake lock keeps phone display on during active workout via Wake Lock API with visibilitychange re-acquisition
- Coaching profile editor allows setting maxes, injuries, equipment, dietary constraints, and training preferences
- Three-tab bottom navigation (Chat / Workout / Profile) with 48px tap targets for gym use
- Human verification confirmed full AI coaching loop is usable on mobile at the gym

## Task Commits

Each task was committed atomically:

1. **Task 1: Workout view components and data fetching** - `924ab27` (feat)
2. **Task 2: Rest timer, wake lock, profile editor, and app routing** - `502b126` (feat)
3. **Task 3: Human verification checkpoint** - APPROVED (no code commit)

## Files Created/Modified
- `src/client/components/WorkoutView.tsx` - Today's workout display with API fetch, exercise list, and empty state
- `src/client/components/ExerciseCard.tsx` - Single exercise card with name, target info, and set rows
- `src/client/components/SetRow.tsx` - Individual set row with reps, weight, Done button (48px targets)
- `src/client/components/RestTimer.tsx` - Large countdown overlay (64px font) with color transitions and Skip button
- `src/client/components/ProfileEditor.tsx` - Coaching profile form (maxes, injuries, equipment, dietary, preferences)
- `src/client/hooks/useRestTimer.ts` - Drift-corrected countdown hook using absolute end time + 250ms interval
- `src/client/hooks/useWakeLock.ts` - Screen Wake Lock API hook with visibilitychange re-acquisition
- `src/client/App.tsx` - Updated with three-tab navigation, wake lock integration, rest timer overlay
- `src/client/components/Chat.tsx` - Minor updates for tab integration
- `src/client/styles/global.css` - Extensive additions for workout view, rest timer, profile editor, and tab bar styling

## Decisions Made
- Three-tab bottom navigation pattern (Chat / Workout / Profile) -- standard mobile pattern, thumb-friendly at gym
- Rest timer renders as a full-screen overlay with color transitions (green -> yellow -> red at <10s) for visibility at arm's length
- Wake lock activates when Workout tab is active, releases on tab switch to conserve battery
- Profile editor uses structured form fields (not freeform text) for maxes and equipment to ensure clean data

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 2 (AI Coaching Loop) is fully complete: chat, workout generation, workout view, rest timer, wake lock, profile editor all functional
- Full coaching loop verified: user chats with AI -> generates workout -> views in Workout tab -> completes sets with rest timer -> provides feedback
- Ready for Phase 3 (RAG Pipeline): training data import, semantic retrieval, and feedback write-back
- All workout data is stored in SQLite and available for embedding in Phase 3
- Coaching profile data ready to enrich RAG context

---
*Phase: 02-ai-coaching-loop*
*Completed: 2026-02-21*
