# Technology Stack

**Project:** William Workout -- RAG-Powered Personal Workout Coaching App
**Researched:** 2026-02-21
**Overall Confidence:** HIGH

---

## Recommended Stack

### Runtime & Build Tools

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | 24.x LTS (24.13.1) | Server runtime | Current LTS with long-term support through 2028. Mature ecosystem, universal hosting support. | HIGH |
| Vite | 7.x (7.3.1) | Frontend build tool | 5x faster full builds than Webpack, HMR in milliseconds. The standard React build tool in 2026. v7 is stable and current. | HIGH |
| TypeScript | 5.x | Type safety across full stack | Non-negotiable for AI apps where schema mismatches between frontend/backend/AI responses cause silent bugs. Gemini SDK has first-class TS support. | HIGH |

### Frontend

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React | 19.x (19.2.4) | UI framework | User's stated choice. v19 is stable with Suspense, Server Components (if needed later), and improved concurrent features. | HIGH |
| React Router | 7.x (7.13.0) | Client-side routing | v7 merges Remix capabilities into React Router. Single package import (`react-router`), no more `react-router-dom`. Stable, well-documented. | HIGH |
| TanStack Query | 5.x (5.90.21) | Server state management | Handles caching, background refetching, optimistic updates for workout data. Eliminates hand-rolled fetch/state logic. Essential for the chat interface where you need to manage streaming + cached data. | HIGH |
| Recharts | 3.x (3.7.0) | Progress charts | React-native SVG charting. Component-based API feels natural in React. Sufficient for the progress charts needed (weight progression, volume over time, body metrics). Simpler API than Chart.js for React use cases. | HIGH |
| Tailwind CSS | 4.x (4.2.0) | Styling | v4 uses a Rust-based engine (100x faster incremental builds). CSS-first config replaces `tailwind.config.js`. The standard styling approach for React in 2026. Works perfectly with shadcn/ui. | HIGH |
| shadcn/ui | latest (CLI 3.0+) | UI component primitives | Not a dependency -- copies component source code into your project. Full ownership, zero runtime overhead, built on Radix UI primitives. Provides chat bubbles, cards, forms, dialogs, and data tables out of the box. Most popular React component approach in 2026. | HIGH |
| date-fns | 4.x | Date formatting/manipulation | Tree-shakable, functional API. Only import what you use. Workout logs need consistent date formatting, relative time display ("3 days ago"), and date math for tracking streaks. | MEDIUM |

### Backend

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Hono | 4.x (4.12.1) | HTTP server framework | TypeScript-first, zero dependencies, 3x faster than Express with 40% less memory. Built on Web Standards (Fetch API). Perfect fit: lightweight enough for a personal app, but with proper middleware (CORS, auth, rate limiting) when needed. Not Express -- Express is legacy in 2026. Not Fastify -- Hono is simpler and portable across runtimes if you ever want to deploy to Cloudflare Workers or Deno. | HIGH |
| Zod | 4.x (4.3.6) | Schema validation | Validates API request/response shapes AND Gemini structured output schemas. Gemini API's structured output mode works with Zod schemas out-of-the-box. Single validation library for everything: API inputs, AI outputs, database records. | HIGH |

### AI / LLM Layer

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @google/genai | 1.x (1.42.0) | Gemini API SDK | The official Google GenAI SDK for JavaScript/TypeScript. GA since May 2025. Supports text generation, streaming, embeddings, structured output, and chat sessions. The old `@google/generative-ai` package is deprecated (end of support: Nov 2025). Use ONLY `@google/genai`. | HIGH |
| Gemini 2.5 Flash | -- | Primary AI model | 1M token context window, built-in "thinking" capabilities, structured JSON output. On the free tier: 10 RPM, 250K TPM, 250 RPD. More than enough for a single-user workout coaching app (you will send maybe 5-20 requests per day). Cheaper and faster than 2.5 Pro while still having strong reasoning. | HIGH |
| gemini-embedding-001 | -- | Text embeddings for RAG | The current recommended embedding model. Supports flexible dimensions (128-3072, default 3072, recommended 768). Trained with Matryoshka Representation Learning for efficient dimensionality. Free tier available. Replaces deprecated text-embedding-004. | HIGH |

### Database & Vector Store

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| better-sqlite3 | 12.x (12.6.2) | SQLite driver | Synchronous API (simpler code), fastest SQLite library for Node.js. SQLite is the right database for a single-user app: zero config, no separate server, file-based backup is trivial, and it handles millions of rows. No Postgres overhead for a personal app. | HIGH |
| sqlite-vec | 0.1.x (0.1.7-alpha.2) | Vector search extension | Loads into better-sqlite3 via `sqliteVec.load(db)`. Pure C, no dependencies, runs anywhere. Keeps your entire stack in one SQLite file: workout data AND vector embeddings. No separate ChromaDB/Pinecone/pgvector server. Perfect for single-user. | MEDIUM |
| Drizzle ORM | 0.45.x (0.45.1) | Database ORM/query builder | TypeScript-first, SQL-like query syntax (not abstracting SQL away like Prisma). Excellent SQLite support. Schema-as-code with migrations via `drizzle-kit`. Lightweight -- adds type safety without the Prisma engine overhead. | HIGH |

### Dev Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vitest | 3.x | Testing | Native Vite integration, compatible API with Jest but faster. Same config as your build tool. | HIGH |
| ESLint | 9.x | Linting | Flat config format in v9. Catches bugs before runtime. | HIGH |
| Prettier | 3.x | Code formatting | Consistent code style, no debates. | HIGH |

---

## Architecture Decision: Why NOT a Full Framework (Next.js, Remix)

This is a personal single-user app. The added complexity of SSR, server components, edge functions, and framework-specific conventions is not justified.

**Use Vite + React (SPA) + separate Hono backend because:**
- **Simpler deployment:** Static frontend (any CDN) + Node.js backend (any VPS, Railway, Fly.io)
- **Clear separation:** Frontend and backend are independently deployable
- **No SSR needed:** Single user, no SEO requirements, no public pages
- **Faster development:** No framework magic to debug, just React and an API

**If this were a multi-user SaaS:** Next.js would be the right choice. For a personal tool, it is overhead.

---

## Architecture Decision: Why SQLite + sqlite-vec Instead of a Dedicated Vector Database

For a personal workout app with a single user's training history:

| Concern | SQLite + sqlite-vec | ChromaDB / Pinecone / pgvector |
|---------|--------------------|---------------------------------|
| Setup complexity | Zero -- one file, loads as extension | Separate server/service to manage |
| Data volume | Months of workouts = thousands of chunks, maybe tens of thousands. SQLite handles millions. | Designed for billions of vectors. Massive overkill. |
| Backup | Copy one `.db` file | Export/import procedures, separate backup strategy |
| Cost | Free, local | Free tier limits or hosting costs |
| Query speed | Sub-millisecond for your data volume | Faster at scale, irrelevant at this scale |
| Joins with relational data | Native -- workout logs and embeddings in same DB | Requires cross-database queries |

**sqlite-vec confidence caveat:** Version 0.1.7-alpha.2 indicates pre-1.0 software. The API may change. However, the core functionality (store vectors, query by cosine similarity) is stable and the author (Alex Garcia) is the recognized SQLite extensions expert. For a personal project, the alpha status is acceptable. If sqlite-vec proves problematic, the fallback is to store embeddings as BLOBs in regular SQLite and do brute-force cosine similarity in JS -- which is fast enough for < 50K vectors.

---

## Architecture Decision: Why Gemini 2.5 Flash over Pro

| Factor | 2.5 Flash | 2.5 Pro |
|--------|-----------|---------|
| Free tier RPM | 10 | 5 |
| Free tier RPD | 250 | 100 |
| Speed | Faster responses | Slower |
| Reasoning | Strong (built-in thinking) | Strongest |
| Cost (paid) | ~4x cheaper | More expensive |
| Context window | 1M tokens | 1M tokens |

**Recommendation:** Start with 2.5 Flash. For a workout coaching app, Flash's reasoning is more than sufficient. The structured output support is identical. If you find the coaching quality lacking for complex periodization advice, upgrade specific requests to 2.5 Pro -- both models use the same SDK, so switching is a one-line change.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Build tool | Vite 7 | Webpack, Turbopack | Webpack is legacy. Turbopack is Next.js-only. Vite is the standard. |
| Backend framework | Hono | Express | Express is legacy (callback-based, no native TS, slower). Hono is the modern choice. |
| Backend framework | Hono | Fastify | Fastify is excellent but heavier. Hono's zero-dependency, Web Standards approach is simpler for a personal app. |
| Full-stack framework | Vite SPA + Hono | Next.js | SSR/SSG overhead unnecessary for single-user app with no SEO needs. |
| Database | SQLite | PostgreSQL | Postgres requires a running server. SQLite is a file. For single-user, SQLite wins on simplicity. |
| Vector store | sqlite-vec | ChromaDB | Separate service to manage. Overkill for personal project data volumes. |
| Vector store | sqlite-vec | Pinecone | Cloud-hosted, adds latency, costs money, data leaves your server. |
| ORM | Drizzle | Prisma | Prisma has a separate query engine binary, slower cold starts, incomplete pgvector/sqlite-vec support. Drizzle is lighter and SQL-native. |
| ORM | Drizzle | Raw SQL | Drizzle adds type safety with minimal abstraction. Raw SQL is error-prone for schema changes. |
| Charts | Recharts | Chart.js (react-chartjs-2) | Chart.js is canvas-based (harder to style with Tailwind), Recharts is SVG/React-native. For a few progress charts, Recharts is simpler. |
| Charts | Recharts | D3.js | D3 is a visualization toolkit, not a charting library. Massive learning curve for simple line/bar charts. |
| Styling | Tailwind + shadcn/ui | Material UI (MUI) | MUI has runtime CSS-in-JS overhead, opinionated Material Design aesthetic, heavier bundle. Tailwind + shadcn gives full control. |
| AI SDK | @google/genai | LangChain.js | LangChain adds massive abstraction overhead for what is fundamentally: embed text, store vectors, retrieve similar, prompt model. Direct SDK usage is simpler and more maintainable for a single-provider app. |
| AI SDK | @google/genai | Vercel AI SDK | Good library but adds an abstraction layer when you are only using one provider (Gemini). Direct SDK keeps things simpler. Consider if you later want to swap providers. |
| Date library | date-fns | Day.js | Both are fine. date-fns is more tree-shakable and functional. Minor preference. |
| Date library | date-fns | Moment.js | Moment is deprecated and massive. Do not use. |

---

## Gemini API Key: Free Tier Viability

The free tier (post-December 2025 reduction) provides:
- **Gemini 2.5 Flash:** 10 RPM, 250K TPM, 250 requests/day
- **gemini-embedding-001:** Free for embedding generation

For a single-user workout app, expected daily usage:
- 5-20 chat interactions (workout generation, feedback)
- 1 batch embedding job when seeding RAG data (one-time)
- Occasional re-embedding for new conversation data

**Verdict:** Free tier is sufficient for this use case. You will not hit rate limits with normal personal usage. If you start doing heavy batch processing (re-embedding large conversation exports), you may need brief paid tier access or throttling logic.

---

## Installation

```bash
# Initialize project
npm create vite@latest william-workout -- --template react-ts

# Frontend dependencies
npm install react-router @tanstack/react-query recharts date-fns zod

# Tailwind CSS v4 (new install process -- no config file needed)
npm install tailwindcss @tailwindcss/vite

# shadcn/ui (run from project root)
npx shadcn@latest init

# Backend dependencies
npm install hono @hono/node-server @google/genai better-sqlite3 sqlite-vec drizzle-orm

# Dev dependencies
npm install -D typescript @types/better-sqlite3 drizzle-kit vitest @testing-library/react eslint prettier
```

**Note on monorepo structure:** For a personal project, a simple folder structure within one repo is fine:

```
william-workout/
  client/          # Vite + React SPA
  server/          # Hono API server
  shared/          # Shared types, Zod schemas
  data/            # SQLite database file, seed data
  .planning/       # Project planning docs
```

No need for npm workspaces or Turborepo. Keep it simple. A `concurrently` or basic npm script can run both dev servers.

---

## Version Pinning Strategy

For a personal project, pin major versions but allow minor/patch updates:

```json
{
  "dependencies": {
    "react": "^19.2.4",
    "react-router": "^7.13.0",
    "@tanstack/react-query": "^5.90.21",
    "recharts": "^3.7.0",
    "tailwindcss": "^4.2.0",
    "hono": "^4.12.1",
    "@hono/node-server": "^1.x",
    "@google/genai": "^1.42.0",
    "better-sqlite3": "^12.6.2",
    "sqlite-vec": "^0.1.7-alpha.2",
    "drizzle-orm": "^0.45.1",
    "zod": "^4.3.6",
    "date-fns": "^4.0.0"
  }
}
```

---

## Key Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| sqlite-vec is alpha (0.1.x) | Medium | Core vector operations are stable. Fallback: brute-force cosine similarity in JS for small datasets. |
| Gemini free tier rate limits reduced further | Low | Personal usage is well within current limits. Paid tier is inexpensive (~$0.15/1M input tokens for Flash). |
| Drizzle ORM approaching v1.0 (breaking changes possible) | Low | Pin to 0.45.x. Migration to 1.0 should be straightforward per their docs. |
| @google/genai SDK is v1.x but rapidly iterating (1.42.0 in < 1 year) | Low | API surface is stable (GA since May 2025). Minor versions add features, not break them. |

---

## Sources

### Verified (HIGH confidence)
- [Google GenAI SDK (npm)](https://www.npmjs.com/package/@google/genai) -- v1.42.0
- [Google GenAI SDK (GitHub)](https://github.com/googleapis/js-genai) -- official TypeScript/JavaScript SDK
- [Deprecated generative-ai-js notice](https://github.com/google-gemini/deprecated-generative-ai-js) -- confirms migration to @google/genai
- [Gemini API Embeddings docs](https://ai.google.dev/gemini-api/docs/embeddings) -- gemini-embedding-001 details
- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models) -- 2.5 Flash/Pro specs
- [Gemini API Structured Output](https://ai.google.dev/gemini-api/docs/structured-output) -- JSON mode with Zod
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) -- free tier limits
- [React v19](https://react.dev/blog/2024/12/05/react-19) -- stable release
- [Vite releases](https://vite.dev/releases) -- v7.3.1
- [sqlite-vec documentation](https://alexgarcia.xyz/sqlite-vec/js.html) -- Node.js setup
- [sqlite-vec (GitHub)](https://github.com/asg017/sqlite-vec) -- v0.1.7-alpha.2
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4) -- CSS-first config, Rust engine
- [Hono (npm)](https://www.npmjs.com/package/hono) -- v4.12.1
- [shadcn/ui](https://ui.shadcn.com/) -- CLI 3.0, Radix-based
- [TanStack Query (npm)](https://www.npmjs.com/package/@tanstack/react-query) -- v5.90.21
- [React Router (npm)](https://www.npmjs.com/package/react-router) -- v7.13.0
- [Recharts (npm)](https://www.npmjs.com/package/recharts) -- v3.7.0
- [better-sqlite3 (npm)](https://www.npmjs.com/package/better-sqlite3) -- v12.6.2
- [Drizzle ORM (npm)](https://www.npmjs.com/package/drizzle-orm) -- v0.45.1
- [Zod (npm)](https://www.npmjs.com/package/zod) -- v4.3.6
- [Node.js releases](https://nodejs.org/en/about/previous-releases) -- v24.13.1 LTS

### Community-verified (MEDIUM confidence)
- [Hono vs Express vs Fastify benchmarks](https://redskydigital.com/us/comparing-hono-express-and-fastify-lightweight-frameworks-today/) -- performance claims
- [Recharts vs Chart.js comparison](https://blog.logrocket.com/best-react-chart-libraries-2025/) -- React charting landscape
- [RAG chunking best practices](https://unstructured.io/blog/chunking-for-rag-best-practices) -- general RAG patterns
- [Gemini free tier rate limit reductions](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits) -- December 2025 changes
