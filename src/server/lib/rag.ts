import { createHash } from 'crypto'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { coachingEmbeddings } from '../db/schema.js'
import { ai } from './gemini.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetrievedSession {
  id: string
  document: string
  snippet: string // first 800 chars for prompt injection
  metadata: Record<string, unknown>
  score: number
}

// ---------------------------------------------------------------------------
// Embedding config
// ---------------------------------------------------------------------------

const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768

/**
 * L2-normalize a vector for cosine similarity at non-3072 dimensions.
 * MRL-reduced embeddings (768-dim from 3072) require normalization.
 */
function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  return norm > 0 ? vec.map((v) => v / norm) : vec
}

/**
 * Generate a normalized embedding for a single text using Gemini.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: [text],
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  })
  return normalize(result.embeddings![0].values!)
}

// ---------------------------------------------------------------------------
// Exercise / Muscle-group keyword extraction
// ---------------------------------------------------------------------------

const EXERCISE_KEYWORDS = [
  'squat',
  'bench',
  'deadlift',
  'press',
  'row',
  'pull-up',
  'pullup',
  'dip',
  'curl',
  'lunge',
  'bridge',
  'plank',
  'pushup',
  'push-up',
  'overhead press',
  'floor press',
  'inverted row',
  'step-up',
  'step up',
  'lateral raise',
  'deadbug',
  'dead bug',
  'bird-dog',
  'bird dog',
]

const MUSCLE_GROUPS: Record<string, string[]> = {
  chest: ['bench', 'pushup', 'push-up', 'dip', 'floor press'],
  back: ['row', 'pull-up', 'pullup', 'deadlift', 'inverted row'],
  legs: ['squat', 'lunge', 'step-up', 'step up', 'bridge', 'glute'],
  shoulders: ['overhead press', 'lateral raise', 'military press'],
  core: ['plank', 'deadbug', 'dead bug', 'bird-dog', 'bird dog'],
}

/**
 * Keyword-based extraction of exercise names and muscle groups from text.
 * Returns deduplicated arrays.
 */
export function extractMetadata(text: string): {
  exercises: string[]
  muscleGroups: string[]
} {
  const lower = text.toLowerCase()
  const exercises = EXERCISE_KEYWORDS.filter((ex) => lower.includes(ex))
  const muscleGroups = Object.entries(MUSCLE_GROUPS)
    .filter(([, keywords]) => keywords.some((k) => lower.includes(k)))
    .map(([group]) => group)
  return {
    exercises: Array.from(new Set(exercises)),
    muscleGroups: Array.from(new Set(muscleGroups)),
  }
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the number of days between two YYYY-MM-DD date strings.
 * Returns a positive number when dateB is after dateA.
 */
export function daysBetween(dateA: string, dateB: string): number {
  const msPerDay = 86_400_000
  return Math.floor(
    (new Date(dateB).getTime() - new Date(dateA).getTime()) / msPerDay
  )
}

// ---------------------------------------------------------------------------
// Retrieval (semantic search with recency re-ranking)
// ---------------------------------------------------------------------------

/**
 * Query pgvector for sessions relevant to the user's message.
 * Over-fetches 2x candidates, then re-ranks with a combined score:
 *   0.7 * semantic similarity + 0.3 * recency (30-day half-life)
 *
 * Returns the top K results (default 5).
 */
export async function retrieveRelevantSessions(
  query: string,
  topK: number = 5
): Promise<RetrievedSession[]> {
  const today = new Date().toISOString().split('T')[0]
  const queryEmbedding = await generateEmbedding(query)
  const vectorStr = `[${queryEmbedding.join(',')}]`

  const raw = await db.execute(sql`
    SELECT
      embedding_id,
      document,
      date,
      type,
      exercises_csv,
      muscle_groups_csv,
      1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM coaching_embeddings
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${topK * 2}
  `)

  if (!raw.length) return []

  const scored = raw.map((row: any) => {
    const semanticScore = Number(row.similarity) || 0
    const sessionDate = row.date || '2026-01-01'
    const daysSince = Math.max(0, daysBetween(sessionDate, today))
    const recencyScore = Math.exp(-daysSince / 30)
    const combined = 0.7 * semanticScore + 0.3 * recencyScore

    return {
      id: row.embedding_id as string,
      document: (row.document as string) ?? '',
      snippet: ((row.document as string) ?? '').slice(0, 800),
      metadata: {
        date: row.date,
        type: row.type,
        exercises: row.exercises_csv,
        muscleGroups: row.muscle_groups_csv,
      },
      score: combined,
    }
  })

  return scored.sort((a, b) => b.score - a.score).slice(0, topK)
}

// ---------------------------------------------------------------------------
// Embed + store (write-back for live sessions)
// ---------------------------------------------------------------------------

/**
 * Embed a user+AI exchange and store it in Postgres with pgvector.
 * Generates a deterministic ID from the date and a content hash so
 * duplicate calls are idempotent (ON CONFLICT DO NOTHING).
 *
 * Designed to be called fire-and-forget -- callers should `.catch()`.
 */
export async function embedAndStore(
  userMessage: string,
  aiResponse: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const combined = `User: ${userMessage}\n\nCoach: ${aiResponse}`
  const date = (metadata.date as string) || new Date().toISOString().split('T')[0]
  const hash = createHash('sha256').update(combined).digest('hex').slice(0, 8)
  const embeddingId = `live-${date}-msg-${hash}`

  const embedding = await generateEmbedding(combined)
  const vectorStr = `[${embedding.join(',')}]`

  await db.execute(sql`
    INSERT INTO coaching_embeddings (embedding_id, document, embedding, date, type, exercises_csv, muscle_groups_csv)
    VALUES (
      ${embeddingId},
      ${combined},
      ${vectorStr}::vector,
      ${date},
      ${(metadata.type as string) || 'live-session'},
      ${(metadata.exercises as string) || ''},
      ${(metadata.muscleGroups as string) || ''}
    )
    ON CONFLICT (embedding_id) DO NOTHING
  `)
}
