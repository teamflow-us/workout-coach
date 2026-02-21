import { createHash } from 'crypto'
import { getCollection } from './chroma.js'

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
 * Query ChromaDB for sessions relevant to the user's message.
 * Over-fetches 2x candidates, then re-ranks with a combined score:
 *   0.7 * semantic similarity + 0.3 * recency (30-day half-life)
 *
 * Returns the top K results (default 5).
 */
export async function retrieveRelevantSessions(
  query: string,
  topK: number = 5
): Promise<RetrievedSession[]> {
  const collection = await getCollection()
  const today = new Date().toISOString().split('T')[0]

  const raw = await collection.query({
    queryTexts: [query],
    nResults: topK * 2,
    include: ['documents', 'metadatas', 'distances'],
  })

  if (!raw.documents?.[0]?.length) return []

  const scored = raw.documents[0].map((doc, i) => {
    const distance = raw.distances![0][i] ?? 1
    const semanticScore = 1 - distance // cosine distance -> similarity [0,1]
    const sessionDate =
      (raw.metadatas![0][i]?.date as string) || '2026-01-01'
    const daysSince = Math.max(0, daysBetween(sessionDate, today))
    const recencyScore = Math.exp(-daysSince / 30)
    const combined = 0.7 * semanticScore + 0.3 * recencyScore

    return {
      id: raw.ids[0][i],
      document: doc ?? '',
      snippet: (doc ?? '').slice(0, 800),
      metadata: raw.metadatas![0][i] ?? {},
      score: combined,
    }
  })

  return scored.sort((a, b) => b.score - a.score).slice(0, topK)
}

// ---------------------------------------------------------------------------
// Embed + store (write-back for live sessions)
// ---------------------------------------------------------------------------

/**
 * Embed a user+AI exchange and store it in ChromaDB.
 * Generates a deterministic ID from the date and a content hash so
 * duplicate calls are idempotent (upsert semantics via ChromaDB add).
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
  const id = `live-${date}-msg-${hash}`

  const collection = await getCollection()
  await collection.add({
    ids: [id],
    documents: [combined],
    metadatas: [metadata as Record<string, string | number | boolean>],
  })
}
