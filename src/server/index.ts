import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sql } from 'drizzle-orm'
import { createAuthMiddleware } from './lib/auth.js'
import { db } from './db/index.js'
import healthRoutes from './routes/health.js'
import workoutRoutes from './routes/workouts.js'
import chatRoutes from './routes/chat.js'
import profileRoutes from './routes/profile.js'
import ragRoutes from './routes/rag.js'
import voiceRoutes from './routes/voice.js'
import nutritionRoutes from './routes/nutrition.js'
import { seedEmbeddings } from './lib/seed-embeddings.js'

const app = new Hono()

// CORS for API routes
app.use('/api/*', cors())

// Optional JWT Auth — enabled when JWT_SECRET is set
const authMiddleware = createAuthMiddleware()
if (authMiddleware) {
  // Auth proxy routes must be accessible without a token
  app.use('/api/*', async (c, next) => {
    if (c.req.path.startsWith('/api/auth/')) {
      return next()
    }
    return authMiddleware(c, next)
  })
}

// ---------- GoTrue Auth Proxy ----------

const GOTRUE_URL = process.env.GOTRUE_URL || 'http://supabase-auth:9999'

app.post('/api/auth/signup', async (c) => {
  const body = await c.req.json()
  const resp = await fetch(`${GOTRUE_URL}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  return c.json(data, resp.status as any)
})

app.post('/api/auth/token', async (c) => {
  const body = await c.req.json()
  const grantType = body.grant_type || 'password'
  const resp = await fetch(`${GOTRUE_URL}/token?grant_type=${grantType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  return c.json(data, resp.status as any)
})

app.post('/api/auth/token/refresh', async (c) => {
  const body = await c.req.json()
  const resp = await fetch(`${GOTRUE_URL}/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  return c.json(data, resp.status as any)
})

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
  console.log(`Auth: ${authMiddleware ? 'enabled (JWT/GoTrue)' : 'disabled (set JWT_SECRET to enable)'}`)

  // pgvector health check + seed on startup
  try {
    const count = await seedEmbeddings()
    const [row] = await db.execute(sql`SELECT COUNT(*) AS count FROM coaching_embeddings`)
    const total = count || Number((row as any).count)
    console.log(`pgvector: connected (${total} embeddings)`)
  } catch (err) {
    console.log('pgvector: table not ready -- RAG disabled, using profile-only mode')
    console.error('pgvector error:', err instanceof Error ? err.message : err)
  }
})

export default app
