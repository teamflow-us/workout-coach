import { loadSession, saveSession, clearSession, isExpiringSoon } from './tokenStore'
import { refreshAccessToken } from './authApi'

let refreshPromise: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  const session = loadSession()
  if (!session?.refresh_token) return null

  try {
    const data = await refreshAccessToken(session.refresh_token)
    if (data.access_token && data.refresh_token && data.expires_in) {
      saveSession(data.access_token, data.refresh_token, data.expires_in)
      return data.access_token
    }
  } catch {
    // refresh failed
  }
  return null
}

async function getValidToken(): Promise<string | null> {
  const session = loadSession()
  if (!session) return null

  if (!isExpiringSoon(session)) return session.access_token

  // Deduplicate concurrent refresh calls
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await getValidToken()

  const headers = new Headers(init?.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let res = await fetch(input, { ...init, headers })

  // Retry once on 401 with a fresh token
  if (res.status === 401 && token) {
    if (!refreshPromise) {
      refreshPromise = doRefresh().finally(() => { refreshPromise = null })
    }
    const freshToken = await refreshPromise
    if (freshToken) {
      headers.set('Authorization', `Bearer ${freshToken}`)
      res = await fetch(input, { ...init, headers })
    }

    // Still 401 after refresh — session is dead
    if (res.status === 401) {
      clearSession()
      window.dispatchEvent(new CustomEvent('auth:signout'))
    }
  }

  return res
}
