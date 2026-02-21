import { Hono } from 'hono'
import { checkChromaHealth, getCollection, COLLECTION_NAME } from '../lib/chroma.js'

const app = new Hono()

// ---------- GET /status -- ChromaDB health and collection info ----------

app.get('/status', async (c) => {
  const healthy = await checkChromaHealth()

  if (!healthy) {
    return c.json({
      status: 'unavailable',
      collection: COLLECTION_NAME,
      count: 0,
      message: 'ChromaDB is not reachable',
    })
  }

  try {
    const collection = await getCollection()
    const count = await collection.count()

    return c.json({
      status: 'connected',
      collection: COLLECTION_NAME,
      count,
    })
  } catch (err) {
    return c.json({
      status: 'error',
      collection: COLLECTION_NAME,
      count: 0,
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

// ---------- GET /collection-info -- Detailed collection info for debugging ----------

app.get('/collection-info', async (c) => {
  const healthy = await checkChromaHealth()

  if (!healthy) {
    return c.json({
      status: 'unavailable',
      message: 'ChromaDB is not reachable',
    })
  }

  try {
    const collection = await getCollection()
    const count = await collection.count()

    // Get a sample of recent chunks by date metadata
    const sample = await collection.get({
      limit: 5,
      include: ['metadatas'],
    })

    const recentChunks = (sample.metadatas || []).map((meta, i) => ({
      id: sample.ids[i],
      date: (meta as Record<string, unknown>)?.date || 'unknown',
      type: (meta as Record<string, unknown>)?.type || 'unknown',
      exercises: (meta as Record<string, unknown>)?.exercises || '',
    }))

    return c.json({
      status: 'connected',
      collection: COLLECTION_NAME,
      count,
      recentChunks,
    })
  } catch (err) {
    return c.json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

export default app
