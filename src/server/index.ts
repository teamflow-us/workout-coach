import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import healthRoutes from './routes/health.js'
import workoutRoutes from './routes/workouts.js'
import chatRoutes from './routes/chat.js'
import profileRoutes from './routes/profile.js'
import ragRoutes from './routes/rag.js'
import { checkChromaHealth, getCollection } from './lib/chroma.js'

const app = new Hono()

// CORS for API routes
app.use('/api/*', cors())

// Mount routes
app.route('/api/health', healthRoutes)
app.route('/api/workouts', workoutRoutes)
app.route('/api/chat', chatRoutes)
app.route('/api/profile', profileRoutes)
app.route('/api/rag', ragRoutes)

const port = 3001

serve({ fetch: app.fetch, port }, async () => {
  console.log(`Server running on http://localhost:${port}`)

  // ChromaDB health check on startup
  try {
    const healthy = await checkChromaHealth()
    if (healthy) {
      const collection = await getCollection()
      const count = await collection.count()
      console.log(`ChromaDB: connected (${count} chunks)`)
    } else {
      console.log('ChromaDB: unavailable -- RAG disabled, using profile-only mode')
    }
  } catch (err) {
    console.log('ChromaDB: unavailable -- RAG disabled, using profile-only mode')
  }
})

export default app
