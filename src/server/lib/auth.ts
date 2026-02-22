import { basicAuth } from 'hono/basic-auth'
import type { MiddlewareHandler } from 'hono'

/**
 * Returns a Basic Auth middleware if AUTH_USERNAME and AUTH_PASSWORD are set.
 * When either variable is missing, auth is disabled and all requests pass through.
 */
export function createAuthMiddleware(): MiddlewareHandler | null {
  const username = process.env.AUTH_USERNAME
  const password = process.env.AUTH_PASSWORD

  if (!username || !password) {
    return null
  }

  return basicAuth({ username, password })
}
