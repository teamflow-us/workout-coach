import type { Context } from 'hono'

/**
 * Extract the authenticated user's ID from the JWT `sub` claim.
 * Throws 401 if no user is set on the context (should never happen
 * when auth middleware or dev-mode middleware is active).
 */
export function getUserId(c: Context): string {
  const user = c.get('user') as { sub?: string } | undefined
  if (!user?.sub) {
    throw new Error('Unauthorized: no user identity on request context')
  }
  return user.sub
}
