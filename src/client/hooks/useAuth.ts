import { useState, useEffect, useCallback, useRef } from 'react'
import { loadSession, saveSession, clearSession, isExpiringSoon } from '../lib/tokenStore'
import { refreshAccessToken, logout as apiLogout } from '../lib/authApi'

export interface AuthState {
  authenticated: boolean
  loading: boolean
  userEmail: string | null
  recoveryToken: string | null
}

function parseJwtEmail(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.email || null
  } catch {
    return null
  }
}

function getRecoveryFromHash(): { accessToken: string; refreshToken: string } | null {
  const hash = window.location.hash
  if (!hash) return null

  const params = new URLSearchParams(hash.slice(1))
  const type = params.get('type')
  const accessToken = params.get('access_token')

  if (type === 'recovery' && accessToken) {
    return {
      accessToken,
      refreshToken: params.get('refresh_token') || '',
    }
  }
  return null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    authenticated: false,
    loading: true,
    userEmail: null,
    recoveryToken: null,
  })
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    // Refresh 60s before expiry
    const delay = Math.max(expiresAt - Date.now() - 60_000, 5_000)
    refreshTimerRef.current = setTimeout(async () => {
      const session = loadSession()
      if (!session) return
      const data = await refreshAccessToken(session.refresh_token)
      if (data.access_token && data.refresh_token && data.expires_in) {
        saveSession(data.access_token, data.refresh_token, data.expires_in)
        const newExpiresAt = Date.now() + data.expires_in * 1000
        scheduleRefresh(newExpiresAt)
      }
    }, delay)
  }, [])

  const setAuthenticated = useCallback((accessToken: string) => {
    const email = parseJwtEmail(accessToken)
    setState({ authenticated: true, loading: false, userEmail: email, recoveryToken: null })
    const session = loadSession()
    if (session) scheduleRefresh(session.expires_at)
  }, [scheduleRefresh])

  const signOut = useCallback(async () => {
    const session = loadSession()
    if (session) {
      try { await apiLogout(session.access_token) } catch {}
    }
    clearSession()
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    setState({ authenticated: false, loading: false, userEmail: null, recoveryToken: null })
  }, [])

  // Initialize on mount
  useEffect(() => {
    // Check for recovery token in URL hash
    const recovery = getRecoveryFromHash()
    if (recovery) {
      // Clear hash from URL
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      setState({
        authenticated: false,
        loading: false,
        userEmail: null,
        recoveryToken: recovery.accessToken,
      })
      return
    }

    // Try to restore from localStorage
    const session = loadSession()
    if (!session) {
      setState(prev => ({ ...prev, loading: false }))
      return
    }

    if (!isExpiringSoon(session, 0)) {
      // Token still valid
      setAuthenticated(session.access_token)
    } else if (session.refresh_token) {
      // Attempt refresh
      refreshAccessToken(session.refresh_token).then(data => {
        if (data.access_token && data.refresh_token && data.expires_in) {
          saveSession(data.access_token, data.refresh_token, data.expires_in)
          setAuthenticated(data.access_token)
        } else {
          clearSession()
          setState(prev => ({ ...prev, loading: false }))
        }
      }).catch(() => {
        clearSession()
        setState(prev => ({ ...prev, loading: false }))
      })
    } else {
      clearSession()
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [setAuthenticated])

  // Listen for forced signout from apiFetch
  useEffect(() => {
    const handler = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      setState({ authenticated: false, loading: false, userEmail: null, recoveryToken: null })
    }
    window.addEventListener('auth:signout', handler)
    return () => window.removeEventListener('auth:signout', handler)
  }, [])

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [])

  const onLoginSuccess = useCallback((accessToken: string, refreshToken: string, expiresIn: number) => {
    saveSession(accessToken, refreshToken, expiresIn)
    setAuthenticated(accessToken)
  }, [setAuthenticated])

  return {
    ...state,
    signOut,
    onLoginSuccess,
  }
}
