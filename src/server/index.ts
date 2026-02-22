import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuthMiddleware } from './lib/auth.js'
import healthRoutes from './routes/health.js'
import workoutRoutes from './routes/workouts.js'
import chatRoutes from './routes/chat.js'
import profileRoutes from './routes/profile.js'
import ragRoutes from './routes/rag.js'
import voiceRoutes from './routes/voice.js'
import nutritionRoutes from './routes/nutrition.js'
import { checkChromaHealth, getCollection } from './lib/chroma.js'
import { seedChroma } from './lib/seed-chroma.js'

const app = new Hono()

// CORS for API routes
app.use('/api/*', cors())

// Optional Basic Auth — enabled when AUTH_USERNAME and AUTH_PASSWORD are set
const authMiddleware = createAuthMiddleware()
if (authMiddleware) {
  app.use('/api/*', authMiddleware)
}

// Mount routes
app.route('/api/health', healthRoutes)
app.route('/api/workouts', workoutRoutes)
app.route('/api/chat', chatRoutes)
app.route('/api/profile', profileRoutes)
app.route('/api/rag', ragRoutes)
app.route('/api/voice', voiceRoutes)
app.route('/api/nutrition', nutritionRoutes)

// Serve static client build in production
app.use('/assets/*', serveStatic({ root: './dist/client' }))
app.use('/favicon.ico', serveStatic({ root: './dist/client' }))

// SPA fallback: serve index.html for all non-API routes
app.get('*', serveStatic({ root: './dist/client', path: '/index.html' }))

const port = parseInt(process.env.PORT || '3000', 10)

serve({ fetch: app.fetch, port }, async () => {
  console.log(`Server running on http://localhost:${port}`)
  console.log(`Auth: ${authMiddleware ? 'enabled (Basic Auth)' : 'disabled (set AUTH_USERNAME & AUTH_PASSWORD to enable)'}`)

  // ChromaDB health check on startup
  try {
    const healthy = await checkChromaHealth()
    if (healthy) {
      const count = await seedChroma()
      const collection = await getCollection()
      const total = count || await collection.count()
      console.log(`ChromaDB: connected (${total} chunks)`)
    } else {
      console.log('ChromaDB: unavailable -- RAG disabled, using profile-only mode')
    }
  } catch (err) {
    console.log('ChromaDB: unavailable -- RAG disabled, using profile-only mode')
    console.error('ChromaDB error:', err instanceof Error ? err.message : err)
  }
})

export default app
