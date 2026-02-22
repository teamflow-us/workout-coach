import { readFileSync, existsSync } from 'fs'
import { getCollection } from './chroma.js'

const SEED_PATH = './chroma-seed.json'
const BATCH_SIZE = 20

interface SeedRecord {
  embedding_id: string
  document: string | null
  date: string | null
  type: string | null
  exercises: string | null
  muscle_groups: string | null
}

/**
 * Seed ChromaDB from the exported JSON file if the collection is empty.
 * Documents are re-embedded via the collection's embedding function.
 * Skips silently if the seed file is missing or the collection already has data.
 */
export async function seedChromaIfEmpty(): Promise<number> {
  if (!existsSync(SEED_PATH)) return 0

  const collection = await getCollection()
  const count = await collection.count()
  if (count > 0) return count

  console.log('ChromaDB: seeding from chroma-seed.json...')
  const records: SeedRecord[] = JSON.parse(readFileSync(SEED_PATH, 'utf-8'))
  const valid = records.filter((r) => r.document)

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE)
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
    console.log(`ChromaDB: seeded ${Math.min(i + BATCH_SIZE, valid.length)}/${valid.length}`)
  }

  console.log('ChromaDB: seed complete.')
  return valid.length
}
