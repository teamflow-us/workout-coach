import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

// Temporary debug endpoint — remove after troubleshooting
app.get('/debug-env', (c) => {
  const mask = (v?: string) => v ? v.slice(0, 4) + '***' + v.slice(-4) : '(not set)'
  return c.json({
    DATABASE_URL: mask(process.env.DATABASE_URL),
    GOTRUE_URL: process.env.GOTRUE_URL || '(not set)',
    JWT_SECRET: mask(process.env.JWT_SECRET),
    SUPABASE_KEY: mask(process.env.SUPABASE_KEY),
    SUPABASE_ANON_KEY: mask(process.env.SUPABASE_ANON_KEY),
    SUPABASE_URL: process.env.SUPABASE_URL || '(not set)',
    GEMINI_API_KEY: mask(process.env.GEMINI_API_KEY),
    NODE_ENV: process.env.NODE_ENV || '(not set)',
    PORT: process.env.PORT || '(not set)',
  })
})

export default app
