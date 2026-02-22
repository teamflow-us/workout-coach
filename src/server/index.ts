import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import healthRoutes from './routes/health.js'
import workoutRoutes from './routes/workouts.js'
import chatRoutes from './routes/chat.js'
import profileRoutes from './routes/profile.js'
import ragRoutes from './routes/rag.js'
import { checkChromaHealth, getCollection } from './lib/chroma.js'
import { seedChromaIfEmpty } from './lib/seed-chroma.js'

const app = new Hono()

// CORS for API routes
app.use('/api/*', cors())

// Mount routes
app.route('/api/health', healthRoutes)
app.route('/api/workouts', workoutRoutes)
app.route('/api/chat', chatRoutes)
app.route('/api/profile', profileRoutes)
app.route('/api/rag', ragRoutes)

// Serve static client build in production
app.use('/assets/*', serveStatic({ root: './dist/client' }))
app.use('/favicon.ico', serveStatic({ root: './dist/client' }))

// SPA fallback: serve index.html for all non-API routes
app.get('*', serveStatic({ root: './dist/client', path: '/index.html' }))

const port = parseInt(process.env.PORT || '3000', 10)

serve({ fetch: app.fetch, port }, async () => {
  console.log(`Server running on http://localhost:${port}`)

  // ChromaDB health check on startup
  try {
    const healthy = await checkChromaHealth()
    if (healthy) {
      const count = await seedChromaIfEmpty()
      const collection = await getCollection()
      const total = count || await collection.count()
      console.log(`ChromaDB: connected (${total} chunks)`)
    } else {
      console.log('ChromaDB: unavailable -- RAG disabled, using profile-only mode')
    }
  } catch (err) {
    console.log('ChromaDB: unavailable -- RAG disabled, using profile-only mode')
  }
})

export default app
