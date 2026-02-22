import { jwtVerify } from 'jose'
import type { MiddlewareHandler } from 'hono'

/**
 * Returns a JWT verification middleware if JWT_SECRET is set.
 * When JWT_SECRET is missing, auth is disabled (dev mode).
 */
export function createAuthMiddleware(): MiddlewareHandler | null {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    return null
  }

  const encodedSecret = new TextEncoder().encode(secret)

  return async (c, next) => {
    const authHeader = c.req.header('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401)
    }

    const token = authHeader.slice(7)

    try {
      const { payload } = await jwtVerify(token, encodedSecret)
      c.set('user', payload)
    } catch {
      return c.json({ error: 'Invalid or expired token' }, 401)
    }

    await next()
  }
}
