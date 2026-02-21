# Requirements: William Workout

**Defined:** 2026-02-21
**Core Value:** The AI coaching loop must work: give feedback on a workout in natural language, get an intelligently adjusted next workout that reflects your full training history.

## v1 Requirements

### Pre-Build Validation

- [x] **VALID-01**: Export existing Gemini conversation and measure token count
- [x] **VALID-02**: Test ChromaDB + Gemini embedding pipeline and structured JSON output composition
- [x] **VALID-03**: Determine RAG strategy (context stuffing / hybrid / full RAG) based on data volume

### AI Coaching

- [ ] **COACH-01**: Chat interface for conversational coaching with Gemini API
- [ ] **COACH-02**: AI generates structured workout plans (exercises, sets, reps, rest, weight)
- [ ] **COACH-03**: Coaching profile always in context (current maxes, injuries, equipment, dietary constraints)
- [ ] **COACH-04**: Output guardrails — validate generated weights against known ranges
- [ ] **COACH-05**: System prompt calibrated to match existing Gemini coaching style
- [ ] **COACH-06**: Freeform text feedback on completed workouts

### RAG & Memory

- [ ] **RAG-01**: Import exported Gemini conversation as seed knowledge base
- [ ] **RAG-02**: Conversation-aware chunking (by coaching exchange, not fixed token size)
- [ ] **RAG-03**: Semantic retrieval of relevant training history during workout generation
- [ ] **RAG-04**: New workout feedback automatically embedded and added to knowledge base

### Workout Interface

- [ ] **UI-01**: Today's workout view — current exercises, sets, reps, rest times, weights
- [ ] **UI-02**: Workout logging — log completed sets via freeform text
- [ ] **UI-03**: Workout history — searchable log of past workouts
- [ ] **UI-04**: Rest timer — countdown between sets
- [ ] **UI-05**: Mobile-first responsive design for gym use

### Progress Tracking

- [ ] **PROG-01**: Progress charts — visual trends for weights, volume over time
- [ ] **PROG-02**: PR tracking — automatic personal record detection and display
- [ ] **PROG-03**: Weekly AI-generated training summaries

### Diet Guidance

- [ ] **DIET-01**: Macro targets displayed alongside workouts
- [ ] **DIET-02**: Food recommendations respecting constraints (gluten-free, high protein, lycopene, lutein sources)
- [ ] **DIET-03**: Dietary constraints stored in coaching profile

### Infrastructure

- [x] **INFRA-01**: Backend API (Hono) with Gemini API key secured server-side
- [x] **INFRA-02**: SQLite database for structured workout data
- [ ] **INFRA-03**: Deployed web app accessible from phone/browser

## v2 Requirements

### Offline & Mobile

- **OFFL-01**: Offline gym mode — cache today's workout for use without connectivity
- **OFFL-02**: PWA installation for home screen access

### Content

- **CONT-01**: Exercise video demonstrations
- **CONT-02**: Form cues and technique tips per exercise

### Analytics

- **ANLYT-01**: Advanced periodization analytics (volume, intensity, frequency over mesocycles)
- **ANLYT-02**: Recovery tracking and readiness score

### Integrations

- **INTG-01**: Wearable integration (heart rate, sleep data)
- **INTG-02**: Apple Health / Google Fit sync

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user authentication | Single user personal tool — no auth needed |
| Social features (sharing, leaderboards) | Solo training tool, adds unnecessary complexity |
| Calorie/meal tracking UI | Diet is macro guidance via coaching profile, not a tracking app |
| Mobile native app | Web-first with responsive design; PWA deferred to v2 |
| Manual workout builder | AI generates the programming; user provides feedback, not structure |
| Exercise video library | Content creation/licensing overhead; defer to v2 |
| Computer vision form checking | High complexity, low reliability, not core value |
| Gamification (streaks, badges) | Anti-feature for personal tool; adds noise |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VALID-01 | Phase 1 | Complete |
| VALID-02 | Phase 1 | Complete |
| VALID-03 | Phase 1 | Complete |
| COACH-01 | Phase 2 | Pending |
| COACH-02 | Phase 2 | Pending |
| COACH-03 | Phase 2 | Pending |
| COACH-04 | Phase 2 | Pending |
| COACH-05 | Phase 2 | Pending |
| COACH-06 | Phase 2 | Pending |
| RAG-01 | Phase 3 | Pending |
| RAG-02 | Phase 3 | Pending |
| RAG-03 | Phase 3 | Pending |
| RAG-04 | Phase 3 | Pending |
| UI-01 | Phase 2 | Pending |
| UI-02 | Phase 2 | Pending |
| UI-03 | Phase 4 | Pending |
| UI-04 | Phase 2 | Pending |
| UI-05 | Phase 2 | Pending |
| PROG-01 | Phase 4 | Pending |
| PROG-02 | Phase 4 | Pending |
| PROG-03 | Phase 4 | Pending |
| DIET-01 | Phase 4 | Pending |
| DIET-02 | Phase 4 | Pending |
| DIET-03 | Phase 2 | Pending |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 after roadmap creation*
