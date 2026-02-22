import { readFileSync, existsSync } from 'fs'
import { getCollection } from './chroma.js'

const SEED_PATH = './chroma-seed.json'
const BATCH_SIZE = 5
const BATCH_DELAY_MS = 5000
const RETRY_DELAY_MS = 60000
const MAX_RETRIES = 3

interface SeedRecord {
  embedding_id: string
  document: string | null
  date: string | null
  type: string | null
  exercises: string | null
  muscle_groups: string | null
}

/**
 * Seed ChromaDB from the exported JSON file.
 * Resumes from where it left off if partially seeded.
 * Retries with backoff on Gemini rate limits (429).
 */
export async function seedChroma(): Promise<number> {
  if (!existsSync(SEED_PATH)) return 0

  const collection = await getCollection()
  const records: SeedRecord[] = JSON.parse(readFileSync(SEED_PATH, 'utf-8'))
  const valid = records.filter((r) => r.document)

  // Check which IDs already exist to support resuming
  const existing = await collection.get({ include: [] })
  const existingIds = new Set(existing.ids)
  const remaining = valid.filter((r) => !existingIds.has(r.embedding_id))

  if (remaining.length === 0) return existingIds.size

  console.log(`ChromaDB: seeding ${remaining.length} remaining of ${valid.length} total...`)

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE)

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await collection.add({
          ids: batch.map((r) => r.embedding_id),
          documents: batch.map((r) => r.document!),
          metadatas: batch.map((r) => {
            const meta: Record<string, string> = {}
            if (r.date) meta.date = r.date
            if (r.type) meta.type = r.type
            if (r.exercises) meta.exercises = r.exercises
            if (r.muscle_groups) meta.muscleGroups = r.muscle_groups
            return meta
          }),
        })
        const done = existingIds.size + Math.min(i + BATCH_SIZE, remaining.length)
        console.log(`ChromaDB: seeded ${done}/${valid.length}`)
        break
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')

        if (isRateLimit && attempt < MAX_RETRIES) {
          const wait = RETRY_DELAY_MS * (attempt + 1)
          console.log(`ChromaDB: rate limited, waiting ${wait / 1000}s (retry ${attempt + 1}/${MAX_RETRIES})`)
          await new Promise((r) => setTimeout(r, wait))
        } else {
          console.error(`ChromaDB: seed failed at batch ${i}:`, msg)
          console.log(`ChromaDB: partial seed complete. Will resume on next restart.`)
          return existingIds.size + i
        }
      }
    }

    if (i + BATCH_SIZE < remaining.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
    }
  }

  console.log('ChromaDB: seed complete.')
  return valid.length
}
