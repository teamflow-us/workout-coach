import { useRef, useEffect, useCallback } from 'react'

export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const isRequestedRef = useRef(false)

  const request = useCallback(async () => {
    if (!('wakeLock' in navigator)) return
    isRequestedRef.current = true
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
    } catch (err) {
      console.warn('Wake Lock request failed:', err)
    }
  }, [])

  const release = useCallback(async () => {
    isRequestedRef.current = false
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release()
      } catch {
        // Already released
      }
      wakeLockRef.current = null
    }
  }, [])

  // Re-acquire on tab visibility change (wake lock is released when tab is hidden)
  useEffect(() => {
    const handleVisibility = async () => {
      if (
        document.visibilityState === 'visible' &&
        isRequestedRef.current &&
        wakeLockRef.current === null
      ) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
        } catch {
          // Ignore re-acquire failures
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
      }
    }
  }, [])

  return { request, release }
}
