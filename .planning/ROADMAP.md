# Roadmap: William Workout

## Overview

William Workout delivers a RAG-powered personal workout coaching app in four phases: validate unknowns and build the backend skeleton, wire up the AI coaching loop with a gym-ready interface, add training memory via RAG so the AI remembers everything, then layer on progress tracking, diet guidance, and deployment. Each phase produces a usable checkpoint -- the app gets smarter and more complete with each delivery.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Validation and Foundation** - Resolve unknowns, stand up backend and database
- [ ] **Phase 2: AI Coaching Loop** - Working AI coach with gym-ready workout interface
- [ ] **Phase 3: RAG Pipeline** - Import training history and give the AI persistent memory
- [ ] **Phase 4: Progress, Diet, and Deploy** - Charts, diet guidance, and ship it

## Phase Details

### Phase 1: Validation and Foundation
**Goal**: Critical unknowns resolved and full-stack skeleton running -- the platform everything else builds on
**Depends on**: Nothing (first phase)
**Requirements**: VALID-01, VALID-02, VALID-03, INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. Gemini conversation export exists as structured data with quality manually verified
  2. Token count measured and RAG strategy decided (context stuffing vs hybrid vs full RAG)
  3. ChromaDB + Gemini embedding pipeline tested with a working script, structured JSON output verified
  4. Hono backend serves API routes with Gemini API key secured server-side
  5. SQLite database with workout schema accepts and returns workout data through the API
**Plans**: TBD

Plans:
- [ ] 01-01: Pre-build validation (export, token count, ChromaDB test)
- [ ] 01-02: Backend and database foundation (Hono, SQLite, Drizzle, React shell)

### Phase 2: AI Coaching Loop
**Goal**: User can chat with an AI coach, receive a structured workout, and use it at the gym on their phone
**Depends on**: Phase 1
**Requirements**: COACH-01, COACH-02, COACH-03, COACH-04, COACH-05, COACH-06, UI-01, UI-02, UI-04, UI-05, DIET-03
**Success Criteria** (what must be TRUE):
  1. User can have a natural language conversation with the AI coach and see streaming responses
  2. AI generates a structured workout (exercises, sets, reps, rest, weight) and it displays in a today's workout view
  3. User can log completed sets via freeform text and provide workout feedback in natural language
  4. Rest timer counts down between sets during a workout
  5. The entire interface is usable on a phone screen at the gym (mobile-first, large tap targets)
**Plans**: TBD

Plans:
- [ ] 02-01: Chat interface and Gemini integration
- [ ] 02-02: Workout view, logging, and gym UX

### Phase 3: RAG Pipeline
**Goal**: The AI remembers the user's full training history and gets smarter with every workout
**Depends on**: Phase 1, Phase 2
**Requirements**: RAG-01, RAG-02, RAG-03, RAG-04
**Success Criteria** (what must be TRUE):
  1. Existing Gemini conversation history is imported, chunked by coaching exchange, and searchable via semantic retrieval
  2. When generating a workout, the AI retrieves relevant past training context (e.g., "what did I squat last week?")
  3. New workout feedback is automatically embedded and added to the knowledge base after each session
  4. The AI's coaching quality visibly improves compared to Phase 2 (references specific past workouts, adapts to stated preferences and injuries)
**Plans**: TBD

Plans:
- [ ] 03-01: Import pipeline and chunking strategy
- [ ] 03-02: Retrieval integration and feedback write-back loop

### Phase 4: Progress, Diet, and Deploy
**Goal**: User can track their progress over time, get diet guidance, and access the app from any device
**Depends on**: Phase 3
**Requirements**: UI-03, PROG-01, PROG-02, PROG-03, DIET-01, DIET-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. User can search past workouts by date and exercise in a workout history view
  2. Progress charts show weight and volume trends over time for any exercise
  3. Personal records are automatically detected and displayed
  4. Macro targets and food recommendations appear alongside workouts, respecting dietary constraints
  5. The app is deployed and accessible from a phone browser at the gym
**Plans**: TBD

Plans:
- [ ] 04-01: Workout history and progress tracking
- [ ] 04-02: Diet guidance and deployment

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Validation and Foundation | 0/2 | Not started | - |
| 2. AI Coaching Loop | 0/2 | Not started | - |
| 3. RAG Pipeline | 0/2 | Not started | - |
| 4. Progress, Diet, and Deploy | 0/2 | Not started | - |
