# Phase 3: RAG Pipeline - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Import the user's full Gemini training history and give the AI persistent memory. The AI retrieves relevant past context when generating workouts, and new conversation data is automatically embedded after each exchange. This phase delivers the data pipeline and retrieval integration — progress tracking UI and workout history views are Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Chunking strategy
- Chunk by workout session — each chunk represents one complete workout discussion (request + generated plan + feedback)
- Keep full conversation text intact within each chunk — preserves nuance like "my shoulder felt off" or "this was too easy"
- Claude's discretion on session boundary detection (time gaps, content signals, or hybrid approach)
- Claude's discretion on handling long sessions (split with overlap vs. keep whole)

### Retrieval transparency
- AI should explicitly cite past workouts when using retrieved context — e.g., "Based on your Feb 10 session where you squatted 275x5..."
- Expandable "Sources used" section below AI responses showing which past sessions were retrieved
- Source view shows 1-2 line snippet preview per retrieved chunk (not full text)
- When no relevant history exists for an exercise, AI just coaches normally without flagging the gap

### Memory scope
- Store everything from every exchange — workouts, injuries, preferences, energy notes, life context
- All conversation content is fair game for the knowledge base
- Recency weighting on retrieval — recent sessions rank higher, but old ones remain searchable
- Merge coaching profile data into RAG (don't keep it as a separate system prompt injection)
- Retrieve 3-5 most relevant past sessions per workout generation

### Write-back behavior
- Embed immediately — each message gets stored as soon as it's sent (both user messages and AI responses)
- Store both sides of the conversation — user feedback AND generated workouts get embedded
- Enrich chunks with metadata tags (exercise names, muscle groups, dates) for filtered retrieval
- If embedding fails, warn the user with a subtle indicator but let conversation continue normally

### Claude's Discretion
- Session boundary detection algorithm for the Gemini export
- Whether to split long sessions or keep them whole
- Exact metadata extraction approach for tagging chunks
- ChromaDB collection structure and indexing strategy
- Embedding retry/queue mechanism for failures
- How recency weighting is implemented in retrieval scoring

</decisions>

<specifics>
## Specific Ideas

- Existing Gemini export is in `data/gemini-export.txt` — Phase 1 already validated and measured tokens
- ChromaDB + Gemini embedding pipeline was tested in Phase 1 (`scripts/test-chromadb.ts`)
- Sources UI should feel like a collapsible detail — not intrusive, but there when you want it
- The merge of profile into RAG means the coaching profile (maxes, injuries, equipment, diet constraints) should be queryable the same way as workout history

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-rag-pipeline*
*Context gathered: 2026-02-21*
