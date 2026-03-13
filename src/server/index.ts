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
    if (c.req.path.startsWith('/api/auth/') || c.req.path.startsWith('/api/health')) {
      return next()
    }
    return authMiddleware(c, next)
  })
} else {
  // Dev mode: set a fake user so getUserId() works without JWT_SECRET
  app.use('/api/*', async (c, next) => {
    ;(c as any).set('user', { sub: 'dev-user-00000000-0000-0000-0000-000000000000' })
    await next()
  })
}

// ---------- GoTrue Auth Proxy ----------

const GOTRUE_URL = process.env.GOTRUE_URL || 'http://supabase-auth:9999'
const SUPABASE_ANON_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || ''

async function gotrueProxy(url: string, init: RequestInit) {
  try {
    // Inject apikey header when GoTrue is behind Kong/API gateway
    if (SUPABASE_ANON_KEY) {
      const headers = new Headers(init.headers)
      if (!headers.has('apikey')) headers.set('apikey', SUPABASE_ANON_KEY)
      init = { ...init, headers }
    }
    return await fetch(url, init)
  } catch (err) {
    console.error(`GoTrue proxy error (${url}):`, err instanceof Error ? err.message : err)
    return null
  }
}

app.post('/api/auth/signup', async (c) => {
  const body = await c.req.json()
  const resp = await gotrueProxy(`${GOTRUE_URL}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp) return c.json({ error: 'Auth service unavailable', error_description: `Cannot reach GoTrue at ${GOTRUE_URL}` }, 502)
  const data = await resp.json()
  return c.json(data, resp.status as any)
})

app.post('/api/auth/token', async (c) => {
  const body = await c.req.json()
  const grantType = body.grant_type || 'password'
  const resp = await gotrueProxy(`${GOTRUE_URL}/token?grant_type=${grantType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp) return c.json({ error: 'Auth service unavailable', error_description: `Cannot reach GoTrue at ${GOTRUE_URL}` }, 502)
  const data = await resp.json()
  return c.json(data, resp.status as any)
})

app.post('/api/auth/token/refresh', async (c) => {
  const body = await c.req.json()
  const resp = await gotrueProxy(`${GOTRUE_URL}/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp) return c.json({ error: 'Auth service unavailable', error_description: `Cannot reach GoTrue at ${GOTRUE_URL}` }, 502)
  const data = await resp.json()
  return c.json(data, resp.status as any)
})

app.post('/api/auth/recover', async (c) => {
  const body = await c.req.json()
  const resp = await gotrueProxy(`${GOTRUE_URL}/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp) return c.json({ error: 'Auth service unavailable', error_description: `Cannot reach GoTrue at ${GOTRUE_URL}` }, 502)
  const data = await resp.json()
  return c.json(data, resp.status as any)
})

app.put('/api/auth/user', async (c) => {
  const auth = c.req.header('Authorization') || ''
  const body = await c.req.json()
  const resp = await gotrueProxy(`${GOTRUE_URL}/user`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': auth,
    },
    body: JSON.stringify(body),
  })
  if (!resp) return c.json({ error: 'Auth service unavailable', error_description: `Cannot reach GoTrue at ${GOTRUE_URL}` }, 502)
  const data = await resp.json()
  return c.json(data, resp.status as any)
})

app.post('/api/auth/logout', async (c) => {
  const auth = c.req.header('Authorization') || ''
  const resp = await gotrueProxy(`${GOTRUE_URL}/logout`, {
    method: 'POST',
    headers: { 'Authorization': auth },
  })
  if (!resp) return c.json({ error: 'Auth service unavailable', error_description: `Cannot reach GoTrue at ${GOTRUE_URL}` }, 502)
  if (resp.status === 204) return c.body(null, 204)
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
app.use('/favicon.svg', serveStatic({ root: './dist/client' }))
app.use('/manifest.webmanifest', serveStatic({ root: './dist/client' }))
app.use('/sw.js', serveStatic({ root: './dist/client' }))
app.use('/icon-*.svg', serveStatic({ root: './dist/client' }))

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
