import { readFileSync, existsSync } from 'fs'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { ai } from './gemini.js'

const SEED_PATH = './chroma-seed.json'
const BATCH_SIZE = 5
const BATCH_DELAY_MS = 5000
const RETRY_DELAY_MS = 60000
const MAX_RETRIES = 3
const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768

interface SeedRecord {
  embedding_id: string
  document: string | null
  date: string | null
  type: string | null
  exercises: string | null
  muscle_groups: string | null
}

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  return norm > 0 ? vec.map((v) => v / norm) : vec
}

/**
 * Seed pgvector embeddings from the exported JSON file.
 * Resumes from where it left off if partially seeded.
 * Retries with backoff on Gemini rate limits (429).
 */
export async function seedEmbeddings(): Promise<number> {
  if (!existsSync(SEED_PATH)) return 0

  const records: SeedRecord[] = JSON.parse(readFileSync(SEED_PATH, 'utf-8'))
  const valid = records.filter((r) => r.document)

  // Check which IDs already exist to support resuming
  const existingRows = await db.execute(sql`
    SELECT embedding_id FROM coaching_embeddings
  `)
  const existingIds = new Set(existingRows.map((r: any) => r.embedding_id))
  const remaining = valid.filter((r) => !existingIds.has(r.embedding_id))

  if (remaining.length === 0) return existingIds.size

  console.log(`pgvector: seeding ${remaining.length} remaining of ${valid.length} total...`)

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE)

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Generate embeddings for the batch
        const result = await ai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: batch.map((r) => r.document!),
          config: { outputDimensionality: EMBEDDING_DIMENSIONS },
        })
        const embeddings = result.embeddings!.map((e) => normalize(e.values!))

        // Insert each record
        for (let j = 0; j < batch.length; j++) {
          const r = batch[j]
          const vectorStr = `[${embeddings[j].join(',')}]`
          await db.execute(sql`
            INSERT INTO coaching_embeddings (embedding_id, document, embedding, date, type, exercises_csv, muscle_groups_csv)
            VALUES (
              ${r.embedding_id},
              ${r.document},
              ${vectorStr}::vector,
              ${r.date},
              ${r.type},
              ${r.exercises || ''},
              ${r.muscle_groups || ''}
            )
            ON CONFLICT (embedding_id) DO NOTHING
          `)
        }

        const done = existingIds.size + Math.min(i + BATCH_SIZE, remaining.length)
        console.log(`pgvector: seeded ${done}/${valid.length}`)
        break
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')

        if (isRateLimit && attempt < MAX_RETRIES) {
          const wait = RETRY_DELAY_MS * (attempt + 1)
          console.log(`pgvector: rate limited, waiting ${wait / 1000}s (retry ${attempt + 1}/${MAX_RETRIES})`)
          await new Promise((r) => setTimeout(r, wait))
        } else {
          console.error(`pgvector: seed failed at batch ${i}:`, msg)
          console.log(`pgvector: partial seed complete. Will resume on next restart.`)
          return existingIds.size + i
        }
      }
    }

    if (i + BATCH_SIZE < remaining.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
    }
  }

  console.log('pgvector: seed complete.')
  return valid.length
}
