import 'dotenv/config'
import { getCollection, checkChromaHealth, COLLECTION_NAME } from '../src/server/lib/chroma.js'
import { extractMetadata } from '../src/server/lib/rag.js'

async function main() {
  console.log('--- Test: ChromaDB Health ---')
  const healthy = await checkChromaHealth()
  console.log('ChromaDB healthy:', healthy)
  if (!healthy) {
    console.error('ChromaDB is not reachable. Start it with: chroma run --path ./chroma-data --port 8100')
    process.exit(1)
  }

  console.log('\n--- Test: getCollection ---')
  const c = await getCollection()
  console.log('Collection name:', c.name)
  console.log('COLLECTION_NAME export:', COLLECTION_NAME)
  const count = await c.count()
  console.log('Document count:', count)

  console.log('\n--- Test: extractMetadata ---')
  const meta1 = extractMetadata('Did 4x8 barbell floor press at 145lbs, then inverted rows at notch 25')
  console.log('Meta 1:', JSON.stringify(meta1))

  const meta2 = extractMetadata('Glute bridges 125lbs 4x15, step-ups bodyweight, overhead press 60lbs')
  console.log('Meta 2:', JSON.stringify(meta2))

  console.log('\nAll tests passed.')
}

main().catch(err => { console.error(err); process.exit(1) })
