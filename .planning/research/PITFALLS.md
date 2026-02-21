# Domain Pitfalls

**Domain:** RAG-powered personal AI workout coaching app
**Stack:** React + Gemini API + RAG pipeline
**Researched:** 2026-02-21

---

## Critical Pitfalls

Mistakes that cause rewrites, broken core functionality, or render the app useless.

---

### Pitfall 1: The Gemini Conversation Export Is Not What You Think

**What goes wrong:** The team assumes Google Takeout will produce a clean, structured JSON dump of the full coaching conversation. In reality, Google Takeout exports for Gemini conversations contain stripped-down prompt-response pairs with truncated content, or in some cases empty placeholder files. The export does not include full conversation context, is missing nuance, and the format is undocumented and inconsistent.

**Why it happens:** Google does not provide a first-party, developer-friendly export for Gemini conversation history. The official Takeout path is designed for GDPR compliance, not data portability for development purposes.

**Consequences:** The entire RAG pipeline depends on this seed data. If the export is truncated, poorly structured, or missing key coaching context (injury notes, preference history, performance trends), the AI will start from a crippled knowledge base. Months of coaching history could be effectively lost.

**Warning signs:**
- Export file sizes seem suspiciously small for months of conversation
- Exported JSON contains HTML-rendered content rather than clean text
- Important conversations or topics you remember discussing are missing from the export
- Repeated or placeholder entries in the exported data

**Prevention:**
1. Investigate the export format BEFORE designing the import pipeline. Use a Chrome extension like [Gemini Chat Exporter](https://chromewebstore.google.com/detail/gemini-chat-exporter/ljmglaakhffcadgboicnmjabiaciniph) or [Gemini Exporter](https://github.com/Liyue2341/gemini-exporter) to produce one JSON file per conversation with role/content/timestamp structure.
2. Do a test export early -- before writing any code -- and manually verify the output contains the coaching detail you expect.
3. Build the import pipeline to handle messy input: HTML-to-text conversion, deduplication, and a manual review step before committing to the vector store.
4. Consider a fallback: manually copying key conversations or summarizing coaching history by hand if automated export is insufficient.

**Phase mapping:** This is a Phase 1 blocker. The import pipeline must be validated before any other RAG work begins. If this fails, the project's core value proposition is compromised.

**Confidence:** HIGH -- multiple sources confirm Takeout limitations; third-party tools exist specifically because the official path is inadequate.

---

### Pitfall 2: Chunking Conversation History Destroys Context

**What goes wrong:** Naive chunking of conversation logs (fixed-size token splits) fragments multi-turn coaching exchanges across chunk boundaries. A conversation where the user says "squats felt heavy today" and the AI responds with a deload recommendation gets split so the recommendation lands in one chunk without the user context that motivated it. The RAG system then retrieves the deload recommendation without the "why," leading to incoherent coaching.

**Why it happens:** Most RAG tutorials demonstrate chunking on documents (articles, manuals) where paragraphs are self-contained. Chat logs are fundamentally different: meaning spans across turns, references are implicit ("the second exercise," "like last week"), and a single coaching decision may unfold over 5-10 messages.

**Consequences:** Retrieved context is fragmented and incoherent. The AI generates advice that contradicts its own prior reasoning because it only sees half the conversation. The "remembers everything" promise breaks silently -- the data is in the system but unretrievable in useful form.

**Warning signs:**
- AI gives advice that contradicts what it said in the original conversation
- Retrieved chunks feel like sentence fragments rather than complete thoughts
- Coaching context about WHY a change was made is consistently missing
- AI cannot explain the reasoning behind a past programming decision

**Prevention:**
1. Use conversation-aware chunking: chunk by complete exchange (user message + AI response as one unit), not by token count. A coaching exchange where 3 user messages and 3 AI responses form a single topic should be one chunk.
2. Apply semantic chunking that detects topic boundaries within the conversation. When the conversation shifts from discussing squat programming to talking about diet, that is a natural chunk boundary.
3. Enrich chunks with metadata: date, topic tags (exercise names, "injury," "deload," "PR"), and the user turn that initiated the exchange.
4. Use chunk overlap (10-20% of tokens) to preserve cross-boundary context, but this is a fallback -- conversation-aware chunking is the primary defense.
5. Target chunk sizes of 400-800 tokens with overlap, per 2025 best practices for retrieval performance.

**Phase mapping:** Must be addressed in the RAG pipeline phase, immediately after the data import phase. The chunking strategy should be designed and tested with real exported data before building the rest of the retrieval system.

**Confidence:** HIGH -- well-documented in RAG literature. The Stack Overflow engineering blog and Weaviate docs both emphasize that chunking strategy is the single biggest determinant of RAG quality.

---

### Pitfall 3: Over-Engineering RAG When Context Window Might Suffice

**What goes wrong:** The project builds a full vector database, embedding pipeline, retrieval system, and reranking stack when a simpler approach would work. For a single-user app with months (not years) of conversation history, the data volume may fit within Gemini's 1M-token context window -- or a curated summary + recent history approach could outperform naive RAG retrieval.

**Why it happens:** "RAG" is the default recommendation for "AI that remembers things." But RAG solves a specific problem: the knowledge base is too large to fit in context. For a personal tool with one user's training history, the actual data volume may be much smaller than assumed.

**Consequences:** Weeks spent building and debugging a vector search pipeline that adds latency, complexity, and retrieval errors -- when stuffing a well-structured summary into the context window would produce better results. The "lost in the middle" problem (LLMs struggle with information in the middle of long contexts) means RAG retrieval quality may actually be worse than a carefully structured prompt with the most relevant data placed strategically.

**Warning signs:**
- Total conversation export is under 500K tokens (fits in Gemini's context window)
- RAG retrieval frequently misses context that you know is in the data
- Responses are worse with RAG than when you manually paste relevant history into a prompt
- Significant development time spent on vector database infrastructure

**Prevention:**
1. Measure the actual data volume first. Export the conversation, count tokens. If it is under 200K tokens, strongly consider a structured-context approach over full RAG.
2. Consider a hybrid approach: maintain a structured "coaching profile" document (preferences, injuries, current program, recent PRs) that always goes in context, plus RAG retrieval for specific historical lookups.
3. Start simple: context stuffing with a well-organized coaching summary. Add RAG only when you hit context window limits or when the "always in context" data grows too large.
4. If RAG is needed, use it selectively -- for historical workout lookups and specific event recall -- not for core coaching context that should always be present.

**Phase mapping:** This is a Phase 0 / architecture decision that should be made before committing to a RAG pipeline. Measure data volume, prototype both approaches, and choose based on evidence. The hybrid approach is likely the right answer.

**Confidence:** HIGH -- Gemini 2.5 Pro's 1M context window and Gemini 3's 1M context window are verified via official pricing docs. The "lost in the middle" problem is documented in ICLR 2025 research.

---

### Pitfall 4: AI Hallucinating Workout Numbers and Fitness Advice

**What goes wrong:** The LLM confidently generates workout prescriptions with fabricated numbers -- weights the user has never lifted, rep ranges inappropriate for their level, or exercise variations they have an injury contraindication for. Research shows LLM hallucination rates in health domains range from 44% to 82% depending on the model and prompting method.

**Why it happens:** LLMs generate plausible-sounding text, not verified facts. If the RAG retrieval misses relevant history (the user's shoulder injury, their actual bench press max), the model fills in the gaps from general fitness knowledge in its training data. A 185lb bench press recommendation sounds reasonable in general -- but is dangerous for a user whose max is 135lb and who has a rotator cuff issue.

**Consequences:** At minimum, frustrating and trust-destroying (the AI "forgets" something important). At worst, physically dangerous: recommending loads that risk injury, ignoring known contraindications, or programming volume that leads to overtraining.

**Warning signs:**
- AI recommends weights significantly higher than anything in the user's history
- AI prescribes exercises the user has previously flagged as problematic
- Workout suggestions do not reflect the progressive overload trajectory visible in history
- AI gives confident dietary advice on medical topics (supplements, restriction diets)

**Prevention:**
1. Always include a "coaching profile" in context with hard constraints: current maxes, known injuries/limitations, equipment available, training frequency. This is not retrieved via RAG -- it is always present in every prompt.
2. Use Gemini's structured output (JSON schema mode) for workout generation. Define a schema that forces the model to specify exercise, sets, reps, weight, and rest -- then validate outputs against the user's known ranges.
3. Implement guardrails: if a recommended weight exceeds the user's known max by more than a configurable percentage (e.g., 10%), flag it. If an exercise appears on the user's "avoid" list, reject and regenerate.
4. Add a disclaimer/medical-advice boundary in the system prompt: "You are a workout coach, not a medical professional. Never recommend specific supplement dosages. When in doubt about an injury, recommend the user consult a professional."
5. For diet guidance specifically, constrain to general principles (protein targets, meal timing) rather than specific prescriptions.

**Phase mapping:** System prompt design and output validation should be built into the very first AI integration phase. Guardrails are not a polish item -- they are core architecture.

**Confidence:** HIGH -- hallucination rates in health domains are documented in peer-reviewed research (Nature Digital Medicine, JMIR). The fitness-specific risk of inappropriate load recommendations is inherent to the domain.

---

## Moderate Pitfalls

Mistakes that cause delays, rework, or degraded user experience.

---

### Pitfall 5: Gemini Free Tier Rate Limits Kill the UX

**What goes wrong:** The app makes multiple API calls per user interaction (embedding query, RAG retrieval, generation) and quickly hits the Gemini free tier limits: 5 RPM for Gemini 2.5 Pro, 10 RPM for Flash, and as few as 100 requests per day for Pro. During a workout, the user sends feedback and waits 30+ seconds for a response because of rate limiting, or gets a 429 error mid-session.

**Why it happens:** Developers build against the API without accounting for the rate limit math. A single "generate today's workout" interaction might require: 1 embedding call, 1-3 RAG retrieval calls, and 1 generation call. At 5 RPM for Pro, that is already a full minute's budget for one interaction.

**Consequences:** The app feels broken during actual use. Worse, rate limits changed significantly in December 2025 (Google slashed free tier quotas), so tutorials and examples from earlier in the year show limits that no longer apply.

**Warning signs:**
- 429 "rate limit exceeded" errors during testing
- Noticeable latency spikes during multi-step RAG + generation flows
- Usage approaching daily request limits during light testing
- App works fine in development but fails during real workout sessions

**Prevention:**
1. Design the architecture to minimize API calls per interaction. Use Gemini's embedding model (gemini-embedding-001, free tier: 100 RPM, 1000 RPD) separately from generation calls.
2. Cache aggressively: embed chunks once at import time, not per query. Cache the "today's workout" response so the user can view it multiple times without re-generating.
3. Use Gemini 2.5 Flash ($0.10/1M tokens) or Flash-Lite (15 RPM free) for lower-stakes operations like summarization and retrieval. Reserve Pro for workout generation.
4. Implement proper retry logic with exponential backoff for 429 errors from day one.
5. Budget the API calls: at 100 RPD on Pro free tier, that is roughly 20-30 full interactions per day. For a personal workout app used once or twice daily, this is viable IF each interaction is efficient. If not, plan to move to paid tier (Gemini 2.5 Flash at $0.10/1M input tokens is very affordable for personal use).
6. Consider Context Caching (Gemini's feature that caches repeated prompt prefixes for up to 75% cost reduction) for the coaching profile and system prompt.

**Phase mapping:** API cost/rate architecture must be designed in the initial backend phase. Do not build the happy path first and add rate limit handling later.

**Confidence:** HIGH -- rate limits verified from official Gemini API pricing documentation (ai.google.dev). December 2025 changes confirmed by multiple sources.

---

### Pitfall 6: Workout Data Model That Cannot Evolve

**What goes wrong:** The data schema for workouts is designed too rigidly (e.g., hardcoded to "exercise, sets, reps, weight") and cannot accommodate the variety of real training: timed exercises (planks), distance exercises (running), AMRAP sets, drop sets, supersets, RPE ratings, tempo prescriptions, or exercises with bands/bodyweight where "weight" does not apply.

**Why it happens:** The initial schema is designed around a simple barbell-training mental model. Real workout programming is much more varied, and the user's training history from the Gemini conversation likely contains all these variations.

**Consequences:** Data loss: workouts that do not fit the schema are either stored incorrectly (a 60-second plank recorded as "1 set, 1 rep, 0 weight") or not stored at all. The AI cannot generate diverse programming because the output schema constrains it. The progress tracking features cannot chart meaningful trends for non-standard exercises.

**Warning signs:**
- Exercises in the imported conversation history that do not fit the schema
- "Other" or "notes" fields being used as escape hatches for data that has no proper home
- Progress charts that only work for barbell movements
- AI-generated workouts that feel monotonous because the schema limits variety

**Prevention:**
1. Design a flexible workout data model from the start. Use a discriminated union / polymorphic approach:
   - Resistance: exercise, sets, reps, weight, RPE
   - Timed: exercise, sets, duration, intensity
   - Distance: exercise, distance, duration, pace
   - AMRAP: exercise, sets, time_cap, reps_achieved
2. Include a freeform "notes" field on every set/exercise for coaching context.
3. Review the actual conversation export before finalizing the schema. What exercise types appear? What metrics does the user track?
4. Make the schema additive: new exercise types can be added without migrating existing data.

**Phase mapping:** Data model design in the core architecture phase. Must be informed by actual conversation export review (Pitfall 1 must be resolved first).

**Confidence:** MEDIUM -- based on fitness app data modeling best practices (multiple sources) and inherent domain complexity. The specific exercises in this user's history are unknown until export is reviewed.

---

### Pitfall 7: The "Lost in the Middle" Retrieval Problem

**What goes wrong:** When the RAG system retrieves multiple chunks and stuffs them into the context window, the LLM's attention to retrieved content follows a U-shaped curve: it pays strong attention to information at the beginning and end of the context, but effectively ignores information in the middle. If the most relevant coaching history lands in the middle of 5 retrieved chunks, the AI may generate advice as if that information does not exist.

**Why it happens:** This is a documented limitation of transformer attention in long contexts, confirmed by Stanford/UW research and presented at ICLR 2025. It affects all current LLMs including Gemini.

**Consequences:** The AI "forgets" relevant history that was technically retrieved. The user says "remember when we changed my squat stance?" and the system retrieves the right chunk, but it lands in position 3 of 5 and the model ignores it. This silently undermines the core value proposition of "AI that remembers everything."

**Warning signs:**
- AI responses do not reflect information you can verify is in the retrieved chunks
- Responses improve when you reduce the number of retrieved chunks
- The AI consistently references the first and last pieces of retrieved context but not the middle
- Reranking retrieved results changes response quality significantly

**Prevention:**
1. Limit retrieval to 3-5 highly relevant chunks rather than stuffing 10+ into context.
2. Use retrieval reordering: place the highest-relevance chunk first and second-highest last (leveraging the U-curve rather than fighting it).
3. Implement a two-stage retrieval: broad recall first, then cross-encoder reranking to identify the truly relevant chunks before sending to the LLM.
4. For the coaching profile (always-present context), place it at the very beginning of the prompt where attention is strongest.
5. Consider summarizing retrieved chunks into a concise context block rather than passing raw chunks, reducing total context length and eliminating the middle-position problem.

**Phase mapping:** RAG retrieval and prompt construction phase. This is an optimization that should be tested once basic retrieval is working.

**Confidence:** HIGH -- ICLR 2025 paper and Stanford/UW research confirm the phenomenon. Mitigation strategies are documented in production RAG systems.

---

### Pitfall 8: No Feedback Loop -- Coaching That Cannot Learn

**What goes wrong:** The RAG system is treated as a static knowledge base. New workouts, feedback, and coaching adjustments are generated but never written back into the retrieval system. Over time, the AI's "memory" diverges from reality: it remembers the imported conversation history but not the last 3 months of actual training done through the app.

**Why it happens:** The import pipeline is built as a one-time operation. The developer focuses on getting the initial data in and does not design a continuous ingestion path for new data. Alternatively, new data is stored in a separate workout log database but never embedded and added to the vector store.

**Consequences:** The AI's coaching degrades over time rather than improving. It references outdated information from the original conversation while being unaware of recent PRs, injuries, or program changes. The user loses trust because the AI "forgets" things that happened last week.

**Warning signs:**
- AI references workout details from the original conversation but not recent sessions
- AI repeats advice that was already tried and abandoned
- The coaching profile document is the only thing that gets updated
- There is no code path from "workout completed" to "vector store updated"

**Prevention:**
1. Design the write path from day one: when a workout is completed and feedback is given, that exchange must be chunked, embedded, and added to the retrieval system.
2. Implement a dual-store approach: structured data (workout logs, PRs, metrics) in a database for querying/charting, AND the coaching narrative (feedback, AI reasoning, adjustments) in the vector store for retrieval.
3. Periodically update the coaching profile document with a summary of recent training: current maxes, active program, recent adjustments. This document should be regenerated (or AI-summarized) regularly.
4. Consider a "memory consolidation" process: periodically summarize older history into compressed chunks, keeping recent history in full detail. This mimics how human memory works and keeps the retrieval system manageable.

**Phase mapping:** Must be architected in the initial RAG design phase, even if the continuous-write implementation happens in a later phase. The data flow diagram must show the feedback loop from the start.

**Confidence:** HIGH -- this is a well-known issue in RAG systems. The "write path" is consistently identified as the most overlooked component in RAG architectures.

---

## Minor Pitfalls

Mistakes that cause annoyance or technical debt but are fixable without rewrites.

---

### Pitfall 9: Structured Output Schema Drift

**What goes wrong:** Gemini's structured output mode (JSON schema) works reliably for simple schemas but occasionally produces unexpected output for complex nested structures like a full workout plan with exercises, supersets, and notes. The app crashes or displays garbage because it trusted the schema enforcement completely and has no fallback parsing.

**Why it happens:** Gemini's structured output with JSON-Schema mode can slightly degrade output quality compared to unstructured output, per benchmarks. Complex schemas increase the chance of the model producing technically valid JSON that is semantically wrong (e.g., rest time "60" meaning 60 seconds or 60 minutes).

**Prevention:**
1. Validate structured output with runtime type checking (Zod or similar) after every generation call.
2. Define clear units in the schema (rest_seconds not rest_time, weight_lbs not weight).
3. Have a fallback: if structured output fails validation, retry once with a simpler prompt, or display the raw AI response rather than crashing.
4. Keep the workout generation schema as flat as possible. Avoid deeply nested structures.

**Phase mapping:** AI integration phase, when building the workout generation pipeline.

**Confidence:** MEDIUM -- based on Gemini structured output documentation and community reports. The specific failure rate depends on schema complexity.

---

### Pitfall 10: Deploying Without Mobile-First Workout UX

**What goes wrong:** The app is built and tested on desktop, then used at the gym on a phone. Text is too small, buttons are too close together for sweaty fingers, scrolling is required to see the current exercise, and there is no way to quickly log a set mid-workout. The core use case (checking your phone between sets at the gym) is frustrating.

**Why it happens:** Development happens on a laptop with a large screen. React component libraries default to desktop-friendly layouts. The developer tests functionality, not ergonomics.

**Prevention:**
1. Design the "today's workout" view mobile-first. Large touch targets, minimal scrolling, high contrast.
2. The current exercise should be prominent with a single-tap way to mark a set as complete.
3. Test on an actual phone in a gym-like context early. Simulating a small screen in browser dev tools is not sufficient -- you miss the sweaty-fingers, quick-glance, between-sets reality.
4. Consider a "gym mode" with simplified UI: just the current exercise, the next set, and a complete button.

**Phase mapping:** UI/UX phase, but the responsive/mobile-first requirement should be a constraint from the first component built.

**Confidence:** HIGH -- this is inherent to the fitness app domain. Every fitness app review mentions mobile usability as make-or-break.

---

### Pitfall 11: Embedding Model Mismatch

**What goes wrong:** The embedding model used to embed the imported conversation chunks is different from (or a different version of) the model used to embed user queries at runtime. The vector similarity scores become unreliable because the two embedding spaces do not align.

**Why it happens:** The developer uses one embedding approach during the import pipeline (maybe a local model for speed) and a different one in production (Gemini's embedding API). Or Gemini updates their embedding model and the old embeddings in the vector store become stale.

**Prevention:**
1. Use the same embedding model (gemini-embedding-001) for both import-time chunk embedding and query-time embedding.
2. Store the embedding model version as metadata alongside embedded chunks.
3. If the embedding model is updated, plan for re-embedding all chunks (this is a batch operation, not a crisis, but it must be planned for).
4. The Gemini embedding free tier (100 RPM, 1000 RPD) is sufficient for a single-user app's query volume but may require batching for the initial import of many chunks.

**Phase mapping:** RAG pipeline setup phase. Lock in the embedding model choice early and use it consistently.

**Confidence:** HIGH -- this is a fundamental RAG requirement documented across all vector database and embedding model documentation.

---

### Pitfall 12: Ignoring the "Coaching Voice" Problem

**What goes wrong:** The AI through the app speaks differently than the AI in the original Gemini conversation. The user had months of rapport, a particular coaching style, and established communication patterns. The new app's system prompt produces a generic fitness-bot voice. The experience feels like starting over with a stranger who has access to your files.

**Why it happens:** The system prompt is written from scratch with generic coaching instructions rather than capturing the specific style and patterns from the original conversation. RAG provides factual context but not personality/style context.

**Prevention:**
1. Before writing the system prompt, review the original conversation and note the AI's coaching style: formal vs casual, how it structures workouts, how it responds to setbacks, recurring phrases or patterns.
2. Include style instructions in the system prompt based on this review. "You are a direct but encouraging coach who structures workouts as..." rather than generic "You are a helpful fitness assistant."
3. Include a few example exchanges from the original conversation as few-shot examples in the system prompt to calibrate tone.
4. This is a subjective quality issue that only the user can evaluate. Build in a way to iterate on the system prompt easily (externalize it, do not hardcode it).

**Phase mapping:** System prompt design, after the conversation export is reviewed. This is a polish item but significantly affects whether the app feels like a continuation of the coaching relationship or a downgrade.

**Confidence:** MEDIUM -- this is specific to the "replacing an existing AI conversation" use case. No direct research found, but it follows from the project's stated core value.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Conversation export/import | Export is truncated or poorly structured (Pitfall 1) | CRITICAL | Test export before writing any code; use third-party export tools |
| RAG pipeline design | Over-engineering vs. context-window approach (Pitfall 3) | CRITICAL | Measure data volume first; consider hybrid approach |
| Chunking strategy | Conversation context destroyed by naive chunking (Pitfall 2) | CRITICAL | Conversation-aware chunking; semantic boundaries |
| AI workout generation | Hallucinated numbers and ignored contraindications (Pitfall 4) | CRITICAL | Coaching profile always in context; output validation; guardrails |
| Backend/API integration | Rate limits block real usage (Pitfall 5) | MODERATE | Design for minimal API calls; implement caching; plan for paid tier |
| Data modeling | Rigid schema cannot represent workout variety (Pitfall 6) | MODERATE | Polymorphic exercise model; review export before finalizing |
| Retrieval quality | Lost-in-the-middle degradation (Pitfall 7) | MODERATE | Limit chunk count; reorder by relevance; summarize |
| Continuous learning | No feedback loop degrades coaching over time (Pitfall 8) | MODERATE | Design write path from day one; dual-store architecture |
| Output parsing | Structured JSON output failures (Pitfall 9) | MINOR | Runtime validation; fallback to raw response |
| Frontend/deployment | Desktop-built UI fails at the gym (Pitfall 10) | MINOR | Mobile-first design; test on real device |
| Embedding pipeline | Model mismatch between import and query time (Pitfall 11) | MINOR | Use same model everywhere; store version metadata |
| System prompt | Loss of coaching personality and rapport (Pitfall 12) | MINOR | Study original conversation style; externalize prompt |

---

## Decision Point: RAG vs. Context Window vs. Hybrid

This deserves special attention because it is the project's defining architectural choice.

**Scenario A: Data fits in context window (<200K tokens)**
Skip the vector database entirely. Build a structured coaching profile + recent workout history that goes directly into the Gemini context window. Simpler architecture, fewer failure modes, better coaching quality (no retrieval errors). Add RAG later only if data grows beyond context limits.

**Scenario B: Data exceeds context but is manageable (200K-1M tokens)**
Hybrid approach: always include a coaching profile document (preferences, injuries, current program, recent sessions) in context, and use RAG for historical lookups ("what did we do for shoulders 6 weeks ago?"). This gets the benefits of both approaches.

**Scenario C: Data significantly exceeds context window (>1M tokens)**
Full RAG is necessary. Invest in proper chunking, embedding, retrieval, and reranking. This is unlikely for a personal app in the first year of use but may become relevant over time.

**Recommendation:** Start with Scenario A or B. Measure the actual data volume after export. The hybrid approach (Scenario B) is the most likely correct architecture for this project -- it provides the "remembers everything" experience without the complexity and failure modes of full RAG for every interaction.

---

## Sources

### RAG Architecture and Pitfalls
- [Seven RAG Pitfalls and How to Solve Them - Label Studio](https://labelstud.io/blog/seven-ways-your-rag-system-could-be-failing-and-how-to-fix-them/)
- [5 RAG Mistakes Costing You 25% of Your AI Budget - Medium](https://medium.com/@divakarapm/5-rag-mistakes-costing-you-25-of-your-ai-budget-in-2025-and-proven-fixes-2c720e11f9e8)
- [From RAG to Context - 2025 Year-End Review - RAGFlow](https://ragflow.io/blog/rag-review-2025-from-rag-to-context)
- [Beyond the Hype: Why RAG Remains Essential - Pinecone](https://www.pinecone.io/learn/rag-2025/)

### Chunking Strategy
- [Breaking Up Is Hard to Do: Chunking in RAG - Stack Overflow](https://stackoverflow.blog/2024/12/27/breaking-up-is-hard-to-do-chunking-in-rag-applications/)
- [Chunking Strategies for RAG - Weaviate](https://weaviate.io/blog/chunking-strategies-for-rag)
- [Best Chunking Strategies for RAG in 2025 - Firecrawl](https://www.firecrawl.dev/blog/best-chunking-strategies-rag-2025)
- [Semantic Chunking for RAG - Multimodal.dev](https://www.multimodal.dev/post/semantic-chunking-for-rag)

### Lost in the Middle Problem
- [Solving the Lost in the Middle Problem - Maxim](https://www.getmaxim.ai/articles/solving-the-lost-in-the-middle-problem-advanced-rag-techniques-for-long-context-llms/)
- [Long-Context LLMs Meet RAG - ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/file/5df5b1f121c915d8bdd00db6aac20827-Paper-Conference.pdf)

### Gemini API
- [Gemini API Pricing - Google AI for Developers](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API Rate Limits - Google AI for Developers](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini Embedding Model - Google Developers Blog](https://developers.googleblog.com/gemini-embedding-available-gemini-api/)
- [Gemini Structured Output - Google AI for Developers](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini API Free Tier Limits 2025 - AI Free API](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-limit)

### Gemini Conversation Export
- [Gemini Exporter - GitHub](https://github.com/Liyue2341/gemini-exporter)
- [How to Export Gemini Chat History - ChatExport.guide](https://chatexport.guide/en/guides/gemini/)
- [How do I download my conversation history - Gemini Apps Community](https://support.google.com/gemini/thread/410548499)

### LLM Hallucination in Health/Fitness
- [Clinical Safety and Hallucination Rates of LLMs - Nature Digital Medicine](https://www.nature.com/articles/s41746-025-01670-7)
- [LLMs in Clinical Nutrition - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12367769/)
- [Why AI Workout Plans Might Be Dangerous - Rolling Out](https://rollingout.com/2025/06/20/ai-workout-plans-risks/)

### Fitness App Architecture
- [How to Build an AI Fitness App - LowCode Agency](https://www.lowcode.agency/blog/ai-fitness-app-development-guide)
- [How to Design a Scalable Data Model for Workout Tracking - Dittofi](https://www.dittofi.com/learn/how-to-design-a-data-model-for-a-workout-tracking-app)
- [AI in Fitness Industry 2026 - OnGraph](https://www.ongraph.com/ai-in-fitness-industry/)

### Vector Embeddings
- [Vector Embeddings Are Lossy - Medium](https://medium.com/data-science/vector-embeddings-are-lossy-heres-what-to-do-about-it-4f9a8ee58bb7)
- [Building a Personal Fitness Insights Engine with Vector Search](https://sneekes.app/posts/building-a-personal-fitness-assistant-with-vector-search/)
