const STORAGE_KEY = 'ww-auth'

export interface StoredSession {
  access_token: string
  refresh_token: string
  expires_at: number // epoch ms
}

export function saveSession(accessToken: string, refreshToken: string, expiresIn: number): void {
  const session: StoredSession = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Date.now() + expiresIn * 1000,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function loadSession(): StoredSession | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredSession
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function isExpiringSoon(session: StoredSession, bufferMs = 60_000): boolean {
  return session.expires_at - Date.now() < bufferMs
}
