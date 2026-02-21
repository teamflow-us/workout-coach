# Project Research Summary

**Project:** William Workout — RAG-Powered Personal Workout Coaching App
**Domain:** Single-user AI fitness coaching web app with RAG memory
**Researched:** 2026-02-21
**Confidence:** HIGH (stack), MEDIUM-HIGH (features, architecture), HIGH (pitfalls)

## Executive Summary

William Workout is a personal, single-user workout coaching app where an AI coach powered by Gemini 2.5 Flash holds the entire training history in memory and coaches through natural conversation. The defining value proposition — "an AI that remembers everything you have ever done and adapts in real time" — is what no commercial app (Fitbod, JuggernautAI, Hevy) currently offers. The recommended architecture is a Vite+React SPA for the frontend and a Hono/Node.js backend with SQLite for structured data, using Gemini's File Search Tool as managed RAG for unstructured coaching history. This sidesteps the full complexity of a self-managed vector database while preserving the semantic retrieval that makes the coaching memory work.

The critical insight from research is that the RAG pipeline is both the highest-value and highest-risk component. Before writing any code, the Gemini conversation export must be validated — the official Google Takeout path is known to produce truncated or poorly structured output, and the entire project's seed data depends on getting this right. Equally important is the architectural decision between full RAG, a hybrid approach, or context-window stuffing: for a personal app with months (not years) of history, the data may fit within Gemini's 1M-token context window, making a hybrid profile+RAG approach more reliable than a full vector retrieval pipeline. Measure first, then decide.

Key risks are concrete and addressable: conversation export quality must be validated before Phase 1 begins; chunking strategy must be conversation-aware (not naive token splits) to preserve coaching coherence; AI-generated workout numbers must be guardrailed against hallucination; and the feedback write-back loop must be designed from day one so the AI's memory improves over time rather than degrading. The free Gemini tier is sufficient for personal use (5-20 daily interactions), but multi-call interactions must be architected to minimize requests per user action to avoid hitting rate limits during workouts.

---

## Key Findings

### Recommended Stack

The stack is optimized for a single-user personal tool, not a commercial SaaS. Every choice prioritizes simplicity, type safety, and low operational overhead over scalability or convention. The frontend is Vite 7 + React 19 + TanStack Query 5 + Tailwind 4 + shadcn/ui, deployed as a static SPA. The backend is Hono 4 on Node.js 24 LTS, with better-sqlite3 + Drizzle ORM for structured workout data and Gemini's File Search Tool for managed RAG. The AI layer uses the `@google/genai` v1.x SDK exclusively — the old `@google/generative-ai` package is deprecated as of November 2025 and must not be used.

See `/home/mcook/Desktop/William Workout/.planning/research/STACK.md` for full version details, installation commands, and alternatives considered.

**Core technologies:**
- React 19 + Vite 7 + TypeScript 5: UI framework and build tool — user's stated choice; Vite 7 is the 2026 standard with Rust-based engine
- Hono 4: HTTP server — TypeScript-first, zero dependencies, 3x faster than Express; not Express (legacy in 2026)
- `@google/genai` 1.x + Gemini 2.5 Flash: AI SDK and model — official GA SDK; Flash chosen over Pro for 2x higher free-tier RPM (10 vs 5) and adequate reasoning quality for fitness coaching
- better-sqlite3 12 + Drizzle ORM 0.45: Structured storage — synchronous API, SQL-like queries, no separate server; perfect for single-user
- Gemini File Search Tool: Managed RAG — Google-hosted chunking/embedding/retrieval; eliminates self-managed vector DB infrastructure
- TanStack Query 5: Server state management — essential for streaming chat UX and caching workout data
- Zod 4: Schema validation — used for both API validation and Gemini structured output schemas
- sqlite-vec 0.1.x: Optional self-managed vector fallback — alpha status; only use if File Search proves inadequate
- Tailwind CSS 4 + shadcn/ui: Styling — CSS-first config, Radix primitives, full ownership of component source

**Critical version note:** Use `@google/genai` (npm) not `@google/generative-ai`. The latter is end-of-life since November 2025.

### Expected Features

The core interaction loop is: Ask coach -> See workout -> Do workout -> Log results -> Coach learns -> Repeat. Every table-stakes feature maps to one link in this loop. No link can be absent.

See `/home/mcook/Desktop/William Workout/.planning/research/FEATURES.md` for full feature table, dependency graph, and competitive landscape.

**Must have (table stakes — breaks the loop if absent):**
- T1: Chat interface with AI coach — conversational, streaming responses; the primary interaction model
- T2: Today's workout view — glanceable, phone-optimized; large tap targets for gym use
- T3: Workout logging (sets/reps/weight) — fast, prefilled from AI; every extra tap is friction
- T4: Workout history — the RAG knowledge base; search by date and exercise
- T5: RAG-powered training memory — embeds history + chat; the entire differentiator
- T6: Adaptive workout generation — RAG + Gemini produces personalized, adaptive workouts
- T7: Mobile-responsive UI — used on a phone at the gym; non-negotiable
- T8: Offline resilience — cache current workout; graceful degradation on signal loss

**Should have (differentiators — elevate from functional to genuinely better):**
- D1: Freeform natural language feedback — "my shoulder felt weird" understood and adapted to; key competitive edge
- D2: Progress charts — weight progression over time; drives engagement and data richness for AI
- D4: Muscle group recovery tracking — derived from history; visual freshness indicator
- D5: Rest timer — triggered after logging a set; simple but essential at the gym
- D6: PR tracking — automatic detection; motivating and feeds progression data
- D7: Workout notes and context tags — enriches RAG corpus; "gym was crowded, skipped squat rack"
- D9: Weekly/monthly training summary — AI-generated; high coaching value

**Build-order priority for differentiators:** D1, D5, D6, D7 (high value, low complexity) then D2, D4, D9 (high value, higher complexity).

**Defer (v2+):**
- D3: Exercise substitution reasoning — prompt engineering polish, not a separate feature
- D8: Coach personality tuning — fun but not functional; add when everything else works
- D4: Muscle recovery tracking — needs weeks of logged data before it is useful

**Anti-features (deliberately do not build):**
- Authentication, social features, gamification, video demos, computer vision form checking, wearable integrations, nutrition tracking, complex onboarding, offline-first sync engine, payments, native apps, admin dashboards

### Architecture Approach

The architecture is a two-tier web app: React SPA (static, served from Express/Hono) communicating with a Node.js backend over a JSON API. All Gemini API calls are proxied through the backend (API key never touches the client). The data layer is dual: SQLite via Drizzle ORM for structured, queryable workout data (plans, logs, progress metrics) and Gemini's File Search Tool for unstructured coaching context (conversation history, freeform feedback, injury notes). Neither replaces the other — vectors handle semantic retrieval; SQL handles aggregations and time-series queries.

The critical architectural question is whether to use Gemini File Search (managed RAG), build self-managed RAG with sqlite-vec, or skip vectors and use a hybrid coaching-profile + context-window approach. The recommendation is to start with File Search as primary RAG since it eliminates an entire infrastructure class, but to validate whether File Search and structured JSON output can compose in a single API call — if they cannot, a two-step approach (retrieve then generate) is the fallback.

See `/home/mcook/Desktop/William Workout/.planning/research/ARCHITECTURE.md` for full component diagram, data flows, SQL schema, code patterns, and deployment guidance.

**Major components:**
1. React SPA (Vite) — UI rendering; no business logic; TanStack Query for server state
2. Hono/Express API Routes — thin HTTP layer; request validation via Zod
3. Coaching Service — core logic: prompt construction, structured output parsing, RAG orchestration, feedback processing
4. Gemini API Client (`@google/genai`) — chat generation, File Search tool invocation, structured output
5. SQLite Database (better-sqlite3 + Drizzle) — workouts, exercises, feedback, progress metrics, conversation log
6. Gemini File Search Store — managed vector RAG; coaching history, freeform feedback, preferences

**Key patterns:**
- API Key Proxy: all Gemini calls go through the backend; never expose key to client
- Dual Response Format: AI response contains both conversational text and structured workout data; parse both server-side
- Feedback-to-RAG Pipeline: every feedback exchange stored in SQLite immediately, uploaded to File Search async in background
- Prompt Templates as Configuration: prompts in dedicated files for easy iteration without touching business logic
- Optimistic UI: message appears immediately; loading state while waiting for Gemini (2-10 second calls)

**Deployment:** Railway (not Vercel/Netlify — SQLite requires a persistent filesystem that serverless cannot provide). Single service: Express serves React build as static files + handles API routes. ~$5/month. Persistent volume for SQLite file.

### Critical Pitfalls

See `/home/mcook/Desktop/William Workout/.planning/research/PITFALLS.md` for full pitfall list, warning signs, and phase-specific guidance.

1. **Gemini conversation export is unreliable** — Google Takeout produces truncated, HTML-rendered, or incomplete exports. Use third-party Chrome extensions (Gemini Chat Exporter, Gemini Exporter on GitHub) to produce structured JSON. Validate export manually BEFORE writing any import code. This is a Phase 0 prerequisite.

2. **Naive chunking destroys coaching context** — Fixed-size token splits fragment multi-turn coaching exchanges. Use conversation-aware chunking: one chunk per complete exchange (user + AI response), with topic boundary detection. Target 400-800 token chunks with 10-20% overlap. Enrich with metadata (date, topic tags, exercise names).

3. **RAG may be over-engineering** — Measure the actual conversation export token count first. If under 200K tokens, context-window stuffing with a structured coaching profile may outperform RAG. If 200K-1M tokens, a hybrid approach (always-present coaching profile + RAG for historical lookups) is likely correct. Full vector RAG for every interaction is probably unnecessary for a personal app in year one.

4. **AI hallucination in workout numbers** — LLM hallucination rates in health domains reach 44-82%. The AI will fabricate weights, ignore injury contraindications, and prescribe inappropriate loads if retrieval misses context. Mitigations: always inject a structured coaching profile with hard constraints (current maxes, injuries, equipment) into every prompt; validate structured output against known user ranges; implement guardrails that flag weights exceeding known max by >10% or exercises on the avoid list.

5. **No feedback write-back loop** — If new workout feedback is not embedded and uploaded to the File Search Store, the AI's memory becomes stale after the initial seed. The write path (workout completed -> chunk feedback -> upload to File Search -> mark synced in SQLite) must be designed from day one, not retrofitted. This is the most commonly overlooked component in RAG systems.

---

## Implications for Roadmap

Based on research, suggested phase structure (4 phases):

### Phase 0: Pre-Build Validation
**Rationale:** Three critical unknowns must be resolved before writing application code. Getting these wrong mid-build causes rewrites. They are cheap to validate upfront.
**Delivers:** Validated conversation export, confirmed token volume and RAG strategy decision, verified File Search + structured output composition
**Addresses:** Pitfall 1 (export format), Pitfall 3 (over-engineering RAG), Architecture open question #1 (File Search + JSON output composition)
**Tasks:**
- Export Gemini conversation history using a third-party tool; manually inspect quality and completeness
- Count tokens in the export to determine RAG strategy (context stuffing vs hybrid vs full RAG)
- Write a minimal test script: call Gemini API with `tools.fileSearch` AND `responseMimeType: 'application/json'` in the same request; confirm they compose or identify the two-step fallback
- Review export for exercise types to inform data model design

**Note:** This is not a traditional "phase" but a validation sprint before Phase 1. Failure here does not block the whole app — it changes the RAG strategy choice.

### Phase 1: Foundation (Core App Shell, No AI)
**Rationale:** Everything depends on the backend skeleton, database, and frontend routing. Building these first validates the full-stack plumbing without AI complexity. Early deployment validation prevents late-stage environment surprises.
**Delivers:** A working web app that can create, store, and display workouts — no AI yet. The scaffold on which everything else is built.
**Addresses:** T3 (workout logging), T4 (workout history), T7 (mobile-responsive UI)
**Avoids:** Pitfall 6 (rigid data model) — design polymorphic exercise schema upfront informed by Phase 0 export review; Pitfall 10 (desktop-built UI) — mobile-first from the first component
**Uses:** Hono + Node.js, SQLite + Drizzle ORM, React + Vite + TanStack Query, Tailwind + shadcn/ui
**Research flag:** Standard patterns — no deep research needed. Hono, Drizzle, and React are well-documented.

### Phase 2: AI Integration (Chat Without RAG)
**Rationale:** Get the AI working conversationally before adding RAG complexity. Validates Gemini integration, structured output parsing, and the coaching prompt in isolation. Produces a genuinely usable app (basic AI coach) as a checkpoint before the hard RAG work.
**Delivers:** Chat interface with Gemini, AI-generated workout plans (structured output), today's workout view, and workouts stored to SQLite. The core coaching loop minus memory.
**Addresses:** T1 (chat interface), T2 (today's workout view), T6 (basic workout generation), D3 (exercise substitution reasoning via prompt)
**Avoids:** Pitfall 4 (hallucination) — coaching profile in every prompt, output validation, guardrails built here not later; Pitfall 5 (rate limits) — design minimal API calls per interaction from the start; Pitfall 9 (structured output failures) — Zod validation + retry/fallback from day one
**Uses:** `@google/genai` 1.x SDK, Gemini 2.5 Flash, Zod structured output, COACHING_SYSTEM_PROMPT in `/server/prompts/`
**Research flag:** Needs validation on structured output reliability and rate limit budgeting during development. The File Search + JSON composition test from Phase 0 gates the RAG strategy for Phase 3.

### Phase 3: RAG Pipeline (Memory and Intelligence)
**Rationale:** This is the differentiating work. Depends on Phase 0 (validated export), Phase 1 (database), and Phase 2 (Gemini integration). Cannot start until all three are proven. The strategy (context stuffing, hybrid, or full RAG) is determined by Phase 0 data volume measurement.
**Delivers:** The AI that "remembers everything." Conversation history imported into retrieval system, freeform feedback stored and retrieved, adaptive workout generation, continuous feedback write-back loop.
**Addresses:** T5 (RAG-powered training memory), T6 (full adaptive generation), D1 (freeform natural language feedback), T8 (offline resilience)
**Avoids:** Pitfall 1 (export quality) — resolved in Phase 0; Pitfall 2 (chunking) — conversation-aware chunking, not token splits; Pitfall 3 (over-engineering) — strategy chosen based on measured data volume; Pitfall 7 (lost in the middle) — limit retrieval to 3-5 chunks, reorder by relevance; Pitfall 8 (no write-back) — feedback-to-RAG pipeline built here; Pitfall 11 (embedding model mismatch) — use gemini-embedding-001 consistently; Pitfall 12 (coaching voice) — system prompt informed by review of original conversation style
**Uses:** Gemini File Search Store (or sqlite-vec as fallback), `@google/genai` file search API, feedback-to-RAG pipeline
**Research flag:** NEEDS DEEPER RESEARCH during planning. Gemini File Search Tool is new (November 2025) with sparse independent benchmarks. Chunking strategy for chat logs vs. documents is a distinct problem. Retrieval quality for workout-specific queries is unvalidated. Plan a `/gsd:research-phase` sprint before implementing Phase 3.

### Phase 4: Polish and Insights
**Rationale:** Quality-of-life features and analytics require accumulated workout data from Phases 2-3 to be meaningful. Cannot be built effectively without weeks of logged workouts.
**Delivers:** Progress charts, PR tracking, rest timer, workout notes/tags, muscle recovery indicators, weekly AI summaries, deployment on Railway
**Addresses:** D2 (progress charts), D5 (rest timer), D6 (PR tracking), D7 (workout notes), D4 (muscle recovery tracking), D9 (weekly summary)
**Uses:** Recharts 3, date-fns 4, Railway deployment with persistent volume
**Research flag:** Standard patterns — no deep research needed. Recharts charting and Railway deployment are well-documented.

### Phase Ordering Rationale

- Phase 0 before Phase 1 because the data model design (Phase 1) must be informed by what exercise types appear in the actual conversation export. Building a schema before seeing the data risks Pitfall 6 (rigid schema that cannot evolve).
- Phase 1 before Phase 2 because Gemini API calls require a working backend server and database to store results. Testing AI without persistence is not a real integration test.
- Phase 2 before Phase 3 because RAG amplifies whatever the base AI behavior is. If the coaching prompt is wrong or structured output parsing is broken, adding RAG on top makes debugging exponentially harder.
- Phase 4 after Phase 3 because charts and summaries require data. Building Recharts integrations before weeks of workout data exists is building against synthetic data and missing real edge cases.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (RAG Pipeline):** Gemini File Search Tool is new as of November 2025 with limited independent benchmarks. Chunking strategy for chat logs is domain-specific. Retrieval quality for structured workout queries vs. semantic coaching queries is unknown. Strongly recommend a `/gsd:research-phase` sprint specifically on: File Search chunking configuration, retrieval quality testing methodology, and fallback strategy if File Search retrieval proves inadequate for workout-specific lookups.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Hono + Drizzle + React + SQLite are mature, well-documented. No novel patterns.
- **Phase 2 (AI without RAG):** Gemini structured output and chat generation are well-documented with official examples. Prompt engineering is iterative, not researchable in advance.
- **Phase 4 (Polish):** Recharts + Railway + progress calculations are all standard implementations.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against official npm packages and official documentation. Version numbers confirmed current as of 2026-02-21. The one caveat is sqlite-vec at alpha status (0.1.7-alpha.2) — acceptable for a personal project but noted. |
| Features | MEDIUM-HIGH | Commercial app landscape surveyed via multiple sources. The distinction between table stakes and differentiators is well-reasoned for a single-user context. Specific competitive claims (Fitbod, JuggernautAI) are sourced from first-party product pages. |
| Architecture | MEDIUM-HIGH | Official Gemini API documentation is strong. The critical gap is Gemini File Search Tool (launched November 2025) — there are limited independent performance benchmarks as of early 2026. The composition of File Search + JSON structured output in a single API call is explicitly unverified and flagged as HIGH PRIORITY to test. |
| Pitfalls | HIGH | RAG chunking pitfalls are documented in peer-reviewed literature and engineering blogs. Hallucination rates in health domains are from Nature Digital Medicine research. Rate limit figures are from official Gemini API pricing docs. Conversation export issues are confirmed by multiple independent sources. |

**Overall confidence:** HIGH for the stack and pitfall mitigations. MEDIUM for the specific RAG strategy until Phase 0 validation is complete.

### Gaps to Address

- **File Search + Structured Output composition:** Whether `tools.fileSearch` and `responseMimeType: 'application/json'` work in a single Gemini API call is unverified. Test this in Phase 0 before committing to the architecture. If they do not compose, the fallback is a two-step call (retrieve then generate), which is straightforward but changes the API call budget math.
- **Conversation export format and quality:** The exact JSON structure from third-party Gemini export tools is not pre-validated. This gates chunking strategy and import pipeline design. Must be resolved before Phase 1 data model is finalized.
- **Actual conversation token volume:** Unknown until the export is inspected. This determines whether the RAG strategy is context-window stuffing (simplest), hybrid profile+RAG (likely), or full vector retrieval (most complex). Do not commit to a RAG architecture before measuring.
- **File Search retrieval quality for workout queries:** How well does File Search handle "what weight did I squat last week?" (factual, specific) vs. "how have my legs been feeling?" (semantic, vague)? Different query types may need different retrieval strategies or hybrid approaches.
- **Coaching voice calibration:** The system prompt must capture the specific coaching style from the original Gemini conversation, not a generic fitness-bot voice. This requires reviewing the original conversation export before writing the system prompt — another reason Phase 0 export validation must come first.

---

## Sources

### Primary (HIGH confidence — official documentation)
- [Google GenAI SDK npm](https://www.npmjs.com/package/@google/genai) — v1.42.0 confirmed current
- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models) — 2.5 Flash/Pro specs, context windows
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) — free tier limits verified (December 2025 changes)
- [Gemini API Structured Output](https://ai.google.dev/gemini-api/docs/structured-output) — JSON schema + Zod integration
- [Gemini API Embeddings](https://ai.google.dev/gemini-api/docs/embeddings) — gemini-embedding-001 specs
- [Deprecated generative-ai-js GitHub](https://github.com/google-gemini/deprecated-generative-ai-js) — confirms migration to @google/genai
- [Google blog: File Search announcement](https://blog.google/innovation-and-ai/technology/developers-tools/file-search-gemini-api/) — File Search Tool capabilities
- [React v19 blog](https://react.dev/blog/2024/12/05/react-19) — stable release confirmed
- [Tailwind CSS v4 blog](https://tailwindcss.com/blog/tailwindcss-v4) — CSS-first config, Rust engine
- [Node.js releases](https://nodejs.org/en/about/previous-releases) — v24.13.1 LTS confirmed
- [Nature Digital Medicine: LLM hallucination in health](https://www.nature.com/articles/s41746-025-01670-7) — 44-82% hallucination rates in health domains
- [ICLR 2025: Long-Context LLMs Meet RAG](https://proceedings.iclr.cc/paper_files/paper/2025/file/5df5b1f121c915d8bdd00db6aac20827-Paper-Conference.pdf) — "lost in the middle" problem confirmed

### Secondary (MEDIUM confidence — community, verified against official sources)
- [philschmid.de: Gemini File Search JavaScript tutorial](https://www.philschmid.de/gemini-file-search-javascript) — API patterns and code examples
- [Stack Overflow blog: Chunking in RAG](https://stackoverflow.blog/2024/12/27/breaking-up-is-hard-to-do-chunking-in-rag-applications/) — chunking strategy best practices
- [Weaviate: Chunking strategies for RAG](https://weaviate.io/blog/chunking-strategies-for-rag) — conversation-aware chunking patterns
- [Fitbod blog: How the Fitbod algorithm works](https://fitbod.me/blog/fitbod-algorithm/) — competitive feature analysis
- [Hevy: Gym progress features](https://www.hevyapp.com/features/gym-progress/) — competitive feature analysis
- [Stormotion: Fitness app UX design](https://stormotion.io/blog/fitness-app-ux/) — mobile gym UX requirements
- [Hono npm](https://www.npmjs.com/package/hono) — v4.12.1 confirmed

### Tertiary (LOW confidence — single source or inference, needs validation)
- [Gemini File Search vs homebrew RAG analysis](https://medium.com/the-low-end-disruptor/google-gemini-file-search-the-end-of-homebrew-rag-1aa1529839fd) — tradeoff analysis; needs independent validation
- [Gemini Exporter GitHub](https://github.com/Liyue2341/gemini-exporter) — third-party export tool; format must be validated against actual export
- [AgentiveAIQ: RAG-Powered AI for Personal Training](https://agentiveaiq.com/listicles/best-5-rag-powered-ai-agent-systems-for-personal-training) — niche site, low confidence

---
*Research completed: 2026-02-21*
*Ready for roadmap: yes — pending Phase 0 validation (export quality, token volume, File Search composition test)*
