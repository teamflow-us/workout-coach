/**
 * Generate vector embeddings for imported chat history.
 * Reads workout_memory.md, chunks into user+AI pairs, embeds via Gemini,
 * and stores in coaching_embeddings.
 *
 * Usage: npx tsx scripts/embed-chat-history.ts
 */
import 'dotenv/config'
import { readFileSync } from 'fs'
import { createHash } from 'crypto'
import { sql } from 'drizzle-orm'
import { db } from '../src/server/db/index.js'
import { ai } from '../src/server/lib/gemini.js'

const USER_ID = '5f84921c-b819-4a5e-aa53-5c344da85ab6'
const EXPORT_PATH = './workout_memory.md'
const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768
const BATCH_SIZE = 5
const BATCH_DELAY_MS = 5000
const RETRY_DELAY_MS = 60000
const MAX_RETRIES = 3

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  return norm > 0 ? vec.map((v) => v / norm) : vec
}

interface Turn {
  role: 'user' | 'model'
  content: string
  turnNumber: number
}

function parseConversation(text: string): Turn[] {
  const turns: Turn[] = []
  const sections = text.split(/\n---\n/)
  let turnNumber = 0

  for (const section of sections) {
    const trimmed = section.trim()
    const userMatch = trimmed.match(/^## User \(Turn (\d+)\)\s*\n+([\s\S]*)/)
    if (userMatch) {
      turnNumber = parseInt(userMatch[1])
      turns.push({ role: 'user', content: userMatch[2].trim(), turnNumber })
      continue
    }
    if (trimmed.startsWith('## Gemini')) {
      const content = trimmed.replace(/^## Gemini\s*\n+/, '').trim()
      if (content) {
        turns.push({ role: 'model', content, turnNumber })
      }
    }
  }
  return turns
}

// Exercise/muscle group extraction (matching rag.ts)
const EXERCISE_KEYWORDS = [
  'squat', 'bench', 'deadlift', 'press', 'row', 'pull-up', 'pullup',
  'dip', 'curl', 'lunge', 'bridge', 'plank', 'pushup', 'push-up',
  'overhead press', 'floor press', 'inverted row', 'step-up', 'step up',
  'lateral raise', 'deadbug', 'dead bug', 'bird-dog', 'bird dog',
]

const MUSCLE_GROUPS: Record<string, string[]> = {
  chest: ['bench', 'pushup', 'push-up', 'dip', 'floor press'],
  back: ['row', 'pull-up', 'pullup', 'deadlift', 'inverted row'],
  legs: ['squat', 'lunge', 'step-up', 'step up', 'bridge', 'glute'],
  shoulders: ['overhead press', 'lateral raise', 'military press'],
  core: ['plank', 'deadbug', 'dead bug', 'bird-dog', 'bird dog'],
}

function extractMetadata(text: string) {
  const lower = text.toLowerCase()
  const exercises = EXERCISE_KEYWORDS.filter((ex) => lower.includes(ex))
  const muscleGroups = Object.entries(MUSCLE_GROUPS)
    .filter(([, keywords]) => keywords.some((k) => lower.includes(k)))
    .map(([group]) => group)
  return {
    exercises: [...new Set(exercises)].join(','),
    muscleGroups: [...new Set(muscleGroups)].join(','),
  }
}

// Estimate date from turn number (conversation started Jan 9, 2026)
function estimateDate(turnNumber: number): string {
  const start = new Date('2026-01-09')
  // Rough: ~3 turns per day on average over 358 messages
  const daysOffset = Math.floor(turnNumber / 3)
  const d = new Date(start.getTime() + daysOffset * 86400000)
  return d.toISOString().split('T')[0]
}

interface Chunk {
  id: string
  document: string
  date: string
  type: string
  exercises: string
  muscleGroups: string
}

function buildChunks(turns: Turn[]): Chunk[] {
  const chunks: Chunk[] = []

  for (let i = 0; i < turns.length; i++) {
    if (turns[i].role !== 'user') continue
    const userTurn = turns[i]
    const modelTurn = turns[i + 1]?.role === 'model' ? turns[i + 1] : null
    if (!modelTurn) continue

    // Combine user + model into a document (max ~4000 chars for embedding quality)
    const combined = `User: ${userTurn.content.slice(0, 2000)}\n\nCoach: ${modelTurn.content.slice(0, 2000)}`
    const hash = createHash('sha256').update(combined).digest('hex').slice(0, 8)
    const date = estimateDate(userTurn.turnNumber)
    const embeddingId = `import-${date}-turn${userTurn.turnNumber}-${hash}`

    const meta = extractMetadata(combined)

    // Determine type
    let type = 'conversation'
    const lower = combined.toLowerCase()
    if (lower.includes('workout') && (lower.includes('set') || lower.includes('rep'))) type = 'workout-log'
    else if (lower.includes('form') || lower.includes('technique') || lower.includes('posture')) type = 'form-guidance'
    else if (lower.includes('calori') || lower.includes('protein') || lower.includes('nutrition') || lower.includes('diet')) type = 'nutrition'
    else if (lower.includes('injury') || lower.includes('pain') || lower.includes('recovery')) type = 'injury-management'
    else if (lower.includes('program') || lower.includes('phase') || lower.includes('plan')) type = 'program-design'

    chunks.push({
      id: embeddingId,
      document: combined,
      date,
      type,
      exercises: meta.exercises,
      muscleGroups: meta.muscleGroups,
    })
  }

  return chunks
}

async function main() {
  const text = readFileSync(EXPORT_PATH, 'utf-8')
  const turns = parseConversation(text)
  const chunks = buildChunks(turns)

  console.log(`Parsed ${turns.length} turns into ${chunks.length} embeddable chunks`)

  // Check which already exist
  const existingRows = await db.execute(sql`
    SELECT embedding_id FROM coaching_embeddings WHERE user_id = ${USER_ID}
  `)
  const existingIds = new Set(existingRows.map((r: any) => r.embedding_id))
  const remaining = chunks.filter((c) => !existingIds.has(c.id))

  if (remaining.length === 0) {
    console.log(`All ${chunks.length} chunks already embedded. Done.`)
    process.exit(0)
  }

  console.log(`${existingIds.size} already embedded, ${remaining.length} remaining`)

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE)

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await ai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: batch.map((c) => c.document),
          config: { outputDimensionality: EMBEDDING_DIMENSIONS },
        })
        const embeddings = result.embeddings!.map((e) => normalize(e.values!))

        for (let j = 0; j < batch.length; j++) {
          const c = batch[j]
          const vectorStr = `[${embeddings[j].join(',')}]`
          await db.execute(sql`
            INSERT INTO coaching_embeddings (user_id, embedding_id, document, embedding, date, type, exercises_csv, muscle_groups_csv)
            VALUES (${USER_ID}, ${c.id}, ${c.document}, ${vectorStr}::vector, ${c.date}, ${c.type}, ${c.exercises}, ${c.muscleGroups})
            ON CONFLICT (embedding_id) DO NOTHING
          `)
        }

        console.log(`Embedded ${Math.min(i + BATCH_SIZE, remaining.length)}/${remaining.length}`)
        break
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')

        if (isRateLimit && attempt < MAX_RETRIES) {
          const wait = RETRY_DELAY_MS * (attempt + 1)
          console.log(`Rate limited, waiting ${wait / 1000}s (retry ${attempt + 1}/${MAX_RETRIES})`)
          await new Promise((r) => setTimeout(r, wait))
        } else {
          console.error(`Failed at batch ${i}:`, msg)
          console.log('Partial embed complete. Re-run to resume.')
          process.exit(1)
        }
      }
    }

    if (i + BATCH_SIZE < remaining.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
    }
  }

  console.log(`Done! ${remaining.length} new embeddings stored for user ${USER_ID}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
