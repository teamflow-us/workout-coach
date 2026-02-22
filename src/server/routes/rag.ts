import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'

const app = new Hono()

// ---------- GET /status -- pgvector health and collection info ----------

app.get('/status', async (c) => {
  try {
    const [row] = await db.execute(sql`SELECT COUNT(*) AS count FROM coaching_embeddings`)
    const count = Number((row as any).count)

    return c.json({
      status: 'connected',
      collection: 'coaching_embeddings',
      count,
    })
  } catch (err) {
    return c.json({
      status: 'error',
      collection: 'coaching_embeddings',
      count: 0,
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

// ---------- GET /collection-info -- Detailed collection info for debugging ----------

app.get('/collection-info', async (c) => {
  try {
    const [countRow] = await db.execute(sql`SELECT COUNT(*) AS count FROM coaching_embeddings`)
    const count = Number((countRow as any).count)

    const sample = await db.execute(sql`
      SELECT embedding_id, date, type, exercises_csv
      FROM coaching_embeddings
      ORDER BY created_at DESC
      LIMIT 5
    `)

    const recentChunks = sample.map((row: any) => ({
      id: row.embedding_id,
      date: row.date || 'unknown',
      type: row.type || 'unknown',
      exercises: row.exercises_csv || '',
    }))

    return c.json({
      status: 'connected',
      collection: 'coaching_embeddings',
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
