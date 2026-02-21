/**
 * Verify the RAG import by running semantic queries and checking metadata.
 */

import 'dotenv/config'
import { getCollection } from '../src/server/lib/chroma.js'
import { retrieveRelevantSessions } from '../src/server/lib/rag.js'

async function main() {
  const collection = await getCollection()
  const count = await collection.count()
  console.log(`Collection count: ${count}`)

  // Verify count > 0
  if (count === 0) {
    console.error('FAIL: Collection is empty')
    process.exit(1)
  }
  console.log('PASS: Collection has documents\n')

  // Query 1: squat workout
  console.log('--- Query: "What was my squat workout like?" ---')
  const squat = await collection.query({
    queryTexts: ['What was my squat workout like?'],
    nResults: 3,
    include: ['metadatas', 'distances', 'documents'],
  })
  for (let i = 0; i < (squat.ids?.[0]?.length ?? 0); i++) {
    console.log(
      `  ${squat.ids[0][i]} | dist: ${squat.distances?.[0]?.[i]?.toFixed(4)} | date: ${squat.metadatas?.[0]?.[i]?.date} | exercises: [${squat.metadatas?.[0]?.[i]?.exercises}]`
    )
  }
  console.log()

  // Query 2: shoulder injury
  console.log('--- Query: "shoulder injury or back pain" ---')
  const injury = await collection.query({
    queryTexts: ['shoulder injury or back pain'],
    nResults: 3,
    include: ['metadatas', 'distances'],
  })
  for (let i = 0; i < (injury.ids?.[0]?.length ?? 0); i++) {
    console.log(
      `  ${injury.ids[0][i]} | dist: ${injury.distances?.[0]?.[i]?.toFixed(4)} | date: ${injury.metadatas?.[0]?.[i]?.date}`
    )
  }
  console.log()

  // Query 3: floor press progress
  console.log('--- Query: "floor press weight progression" ---')
  const press = await collection.query({
    queryTexts: ['floor press weight progression'],
    nResults: 3,
    include: ['metadatas', 'distances'],
  })
  for (let i = 0; i < (press.ids?.[0]?.length ?? 0); i++) {
    console.log(
      `  ${press.ids[0][i]} | dist: ${press.distances?.[0]?.[i]?.toFixed(4)} | date: ${press.metadatas?.[0]?.[i]?.date} | exercises: [${press.metadatas?.[0]?.[i]?.exercises}]`
    )
  }
  console.log()

  // Query 4: Test retrieveRelevantSessions with recency scoring
  console.log('--- retrieveRelevantSessions("glute bridge workout results") ---')
  const results = await retrieveRelevantSessions('glute bridge workout results', 3)
  for (const r of results) {
    console.log(`  ${r.id} | score: ${r.score.toFixed(4)} | date: ${r.metadata.date} | exercises: [${r.metadata.exercises}]`)
    console.log(`  Snippet: ${r.snippet.slice(0, 120).replace(/\n/g, ' ')}...`)
    console.log()
  }

  // Check metadata completeness
  console.log('--- Metadata check ---')
  const sample = await collection.get({
    ids: ['gemini-import-000', 'gemini-import-050', 'coaching-profile'],
    include: ['metadatas'],
  })
  for (let i = 0; i < sample.ids.length; i++) {
    const meta = sample.metadatas?.[i] ?? {}
    console.log(`${sample.ids[i]}:`)
    console.log(`  type: ${meta.type}`)
    console.log(`  date: ${meta.date}`)
    console.log(`  exercises: ${meta.exercises}`)
    console.log(`  muscleGroups: ${meta.muscleGroups}`)
    const hasType = !!meta.type
    const hasDate = !!meta.date
    console.log(`  ${hasType && hasDate ? 'PASS' : 'FAIL'}: required fields present`)
    console.log()
  }

  console.log('All verification checks completed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
