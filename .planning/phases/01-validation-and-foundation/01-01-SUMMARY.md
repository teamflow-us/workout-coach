---
phase: 01-validation-and-foundation
plan: 01
subsystem: infra, validation
tags: [gemini, chromadb, embedding, token-counting, zod, structured-output, rag-strategy]

# Dependency graph
requires:
  - phase: none
    provides: greenfield project
provides:
  - Validated Gemini coaching export (395KB, 179 user turns, 6744 lines)
  - Token count measurement (106,313 tokens via Gemini countTokens API)
  - RAG strategy decision (context stuffing + caching)
  - Proven ChromaDB + Gemini embedding pipeline (gemini-embedding-001, 3072-dim)
  - Proven Gemini structured JSON output with Zod v4 schema validation
  - Three reusable validation scripts
affects: [phase-2-ai-coaching-loop, phase-3-rag-pipeline]

# Tech tracking
tech-stack:
  added: ["@google/genai", chromadb, "@chroma-core/google-gemini", zod, zod-to-json-schema, dotenv, tsx]
  patterns: [custom-chromadb-embedding-function, z.toJSONSchema-for-gemini-structured-output, chroma-python-server-on-port-8100]

key-files:
  created:
    - scripts/validate-export.ts
    - scripts/count-tokens.ts
    - scripts/test-chromadb.ts
    - data/gemini-export.txt
  modified:
    - package.json
    - tsconfig.json

key-decisions:
  - "RAG strategy: context stuffing + caching (106K tokens fits 1M window, caching reduces cost)"
  - "Embedding model: gemini-embedding-001 (3072 dimensions) replaces deprecated text-embedding-004"
  - "Custom embedding function: @chroma-core/google-gemini bundles old SDK, use direct @google/genai instead"
  - "Zod v4: use z.toJSONSchema() natively, not zodToJsonSchema() which produces empty definitions"
  - "ChromaDB server: run via Python CLI on port 8100 (port 8000 occupied by anthias nginx, npx chroma requires GLIBC_2.39)"

patterns-established:
  - "Custom IEmbeddingFunction implementation wrapping @google/genai for ChromaDB"
  - "z.toJSONSchema() for Gemini responseSchema (strip $schema key before passing to API)"
  - "ChromaDB Python server on port 8100 via `chroma run --path ./chroma-data --port 8100`"

# Metrics
duration: 8min
completed: 2026-02-21
---

# Phase 1 Plan 1: Pre-build Validation Summary

**106K-token Gemini coaching export validated, RAG strategy decided (context stuffing + caching), ChromaDB + Gemini embedding pipeline and structured JSON output proven end-to-end**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-21T20:31:26Z
- **Completed:** 2026-02-21T20:39:24Z
- **Tasks:** 3
- **Files modified:** 7 (3 scripts created, package.json, tsconfig.json, .gitignore, data/gemini-export.txt)

## Accomplishments

- Validated Gemini coaching conversation export: 395KB, 6744 lines, 179 user turns detected via "You said" markers, ~68,817 words
- Measured exact token count via Gemini API: 106,313 tokens (1.54 tokens/word, 276 tokens/KB)
- Decided RAG strategy: **context stuffing + caching** -- conversation fits within Gemini's 1M context window but is large enough to benefit from context caching to reduce per-request cost
- Proved ChromaDB semantic search pipeline: added 3 sample workout docs with Gemini embeddings, queried "What was my squat workout like?" and correctly retrieved the squat workout as top result (distance: 0.481)
- Proved Gemini structured JSON output: generated a 4-exercise workout from a Zod schema, parsed and validated successfully

## Validation Results

### VALID-01: Export Quality
- **Status:** PASS
- **File:** 395,058 bytes (385.8 KB)
- **Lines:** 6,744 | **Words:** ~68,817
- **User turns:** 179 (detected via "You said" markers)
- **Structure:** Clear delimiter pattern, first and last content verified

### VALID-02: ChromaDB + Gemini Pipeline
- **Status:** PASS
- **Embedding model:** gemini-embedding-001 (3072 dimensions)
- **ChromaDB:** Documents stored, semantic query returned correct top result
- **Structured output:** Gemini produced valid JSON matching Zod workout schema

### VALID-03: RAG Strategy Decision
- **Status:** DECIDED
- **Token count:** 106,313
- **Recommendation:** Context stuffing + caching
- **Rationale:** At 106K tokens, the full conversation fits in the 1M window. Caching the conversation prefix will reduce per-request API costs significantly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize project and install validation dependencies** - `5f5f177` (chore)
2. **Task 2: User exports Gemini conversation** - N/A (user action, checkpoint)
3. **Task 3: Build validation scripts and execute validation pipeline** - `e8c2c9e` (feat)

## Files Created/Modified

- `scripts/validate-export.ts` - Export quality validation (file stats, turn detection, quality assessment)
- `scripts/count-tokens.ts` - Token counting via Gemini API with RAG strategy recommendation
- `scripts/test-chromadb.ts` - End-to-end ChromaDB + Gemini embedding + structured JSON output test
- `data/gemini-export.txt` - Exported Gemini coaching conversation (user-provided)
- `package.json` - Project init with ESM, validation dependencies
- `tsconfig.json` - TypeScript config (ES2022, NodeNext)
- `.gitignore` - Ignores node_modules, .env, data/, dist/, chroma-data/

## Decisions Made

1. **RAG strategy: context stuffing + caching** - At 106,313 tokens, the full coaching history fits within Gemini's 1M context window. No chunking/retrieval needed for the current dataset. Context caching will reduce repeated per-request costs.

2. **Embedding model: gemini-embedding-001** - The `text-embedding-004` model referenced in documentation is no longer available via the current API version. `gemini-embedding-001` is the only available embedding model and produces 3072-dimensional vectors.

3. **Custom embedding function for ChromaDB** - The `@chroma-core/google-gemini` package bundles `@google/genai@0.14.1` internally (v1beta API) which doesn't support the current `gemini-embedding-001` model. Created a custom `IEmbeddingFunction` implementation using the project's `@google/genai@1.42.0` directly.

4. **Zod v4 JSON schema: use z.toJSONSchema()** - The `zod-to-json-schema` package produces empty definitions for Zod v4 schemas. Zod v4 includes native `z.toJSONSchema()` that works correctly. Must strip `$schema` key before passing to Gemini API.

5. **ChromaDB server on port 8100** - Port 8000 is occupied by an anthias nginx container. Additionally, `npx chroma run` (JS bindings) requires GLIBC_2.39 which is unavailable. Using the Python `chroma` CLI instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ChromaDB JS bindings incompatible with system GLIBC**
- **Found during:** Task 3 (ChromaDB pipeline test)
- **Issue:** `npx chroma run` fails with `GLIBC_2.39 not found` -- the `chromadb-js-bindings-linux-x64-gnu` native module requires a newer glibc than available on this system
- **Fix:** Used Python `chroma` CLI (`pip3 install chromadb` was already installed) to run the server. Changed default port to 8100 since port 8000 is occupied by anthias nginx.
- **Files modified:** scripts/test-chromadb.ts
- **Verification:** ChromaDB heartbeat returns successfully on port 8100
- **Committed in:** e8c2c9e (Task 3 commit)

**2. [Rule 1 - Bug] @chroma-core/google-gemini uses deprecated API version**
- **Found during:** Task 3 (ChromaDB embedding test)
- **Issue:** The `@chroma-core/google-gemini` embedding function bundles `@google/genai@0.14.1` which uses the v1beta API. The `text-embedding-004` model is not available on v1beta -- only `gemini-embedding-001` is available via the current API.
- **Fix:** Created a custom `GeminiEmbeddingFunction` class implementing `IEmbeddingFunction` that uses the project's `@google/genai@1.42.0` directly with `gemini-embedding-001`.
- **Files modified:** scripts/test-chromadb.ts
- **Verification:** Embeddings generated successfully (3072 dimensions), semantic query returned correct results
- **Committed in:** e8c2c9e (Task 3 commit)

**3. [Rule 1 - Bug] zod-to-json-schema produces empty definitions for Zod v4**
- **Found during:** Task 3 (Gemini structured output test)
- **Issue:** `zodToJsonSchema(schema, "WorkoutSchema")` produces `{"definitions":{"WorkoutSchema":{}}}` with Zod v4, causing Gemini to return invalid JSON (array of nulls instead of the expected object).
- **Fix:** Switched to Zod v4's native `z.toJSONSchema(schema)` which produces a correct JSON Schema. Stripped `$schema` key before passing to Gemini's `responseSchema`.
- **Files modified:** scripts/test-chromadb.ts
- **Verification:** Gemini returned valid JSON matching the Zod schema, parsed and validated successfully
- **Committed in:** e8c2c9e (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correct operation. No scope creep. The custom embedding function and z.toJSONSchema pattern should be used in all future phases.

## Issues Encountered

- Port 8000 is occupied by an existing anthias nginx Docker container -- used port 8100 for ChromaDB instead
- ChromaDB client warnings about "No embedding function configuration found for collection schema deserialization" are cosmetic and do not affect functionality (custom embedding functions work correctly)

## User Setup Required

None - GEMINI_API_KEY was already configured during the checkpoint phase.

## Next Phase Readiness

- All three critical unknowns resolved: export quality confirmed, token count measured, pipeline proven
- RAG strategy decision (context stuffing + caching) simplifies Phase 3 architecture -- no chunking strategy needed initially
- Custom embedding function pattern ready for reuse in production ChromaDB integration
- Gemini structured JSON output with Zod v4 pattern (`z.toJSONSchema()`) proven for workout data modeling
- **Concern:** `@chroma-core/google-gemini` package is effectively unusable (old SDK); plan to use custom embedding function going forward
- **Concern:** `zod-to-json-schema` is broken with Zod v4; use `z.toJSONSchema()` exclusively

---
*Phase: 01-validation-and-foundation*
*Completed: 2026-02-21*
