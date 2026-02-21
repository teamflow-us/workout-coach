# William Workout

## What This Is

A personal workout coaching app that replaces an ongoing Google Gemini conversation with a purpose-built React application. It uses RAG (Retrieval-Augmented Generation) backed by months of existing coaching history to provide adaptive workout programming, progress tracking, and a structured training interface — all connected to the Gemini API for continued AI-driven coaching without context window degradation.

## Core Value

The AI coaching loop must work: give feedback on a workout in natural language, get an intelligently adjusted next workout that reflects your full training history.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Import existing Gemini conversation as RAG training data
- [ ] Chat interface for adaptive coaching via Gemini API
- [ ] AI generates workouts based on full training history (via RAG)
- [ ] Freeform text feedback on completed workouts
- [ ] Today's workout view — exercises, sets, reps, rest times
- [ ] Workout history log — searchable past workouts
- [ ] Progress tracking — charts showing weights, PRs, trends over time
- [ ] Secondary diet guidance integrated into coaching
- [ ] Deployed and accessible from phone/browser

### Out of Scope

- Multi-user support — single user app, no auth system needed
- Mobile native app — web-first, responsive design for phone access
- Real-time collaboration — solo training tool
- Manual workout builder — AI generates the programming
- Calorie/macro tracking UI — diet is secondary guidance via chat, not a tracking feature

## Context

- Months of existing Gemini coaching conversation containing: exercise preferences, performance history, injury notes, training adjustments, diet guidance, and coaching context
- Gemini conversation export not yet obtained — Google Takeout likely source, format TBD
- User provides workout feedback as freeform natural language text (e.g., "squats felt heavy, cut the last set short")
- AI should remember everything: preferences, performance trends, injuries/limitations, what's worked and what hasn't
- RAG is the core architectural decision — enables the AI to maintain unlimited coaching context without context window limits

## Constraints

- **API**: Google Gemini API — continuing with the same model that built the coaching relationship
- **Frontend**: React — user's chosen framework
- **Deployment**: Must be hosted/deployed for access from any device
- **API Security**: Backend required to keep Gemini API key server-side
- **Data Source**: Initial RAG data comes from exported Gemini conversation — import pipeline needed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Gemini API over other LLMs | Continuity with existing coaching relationship and conversation style | — Pending |
| RAG over fine-tuning | RAG allows incremental knowledge updates as new workouts happen, no retraining needed | — Pending |
| Single user, no auth | Personal tool — simplifies architecture significantly | — Pending |
| Deployed web app | Need phone access during workouts at the gym | — Pending |
| ChromaDB as vector store | User preference — established, well-documented vector DB with good Python/JS ecosystem | — Pending |

---
*Last updated: 2026-02-21 after roadmap creation*
