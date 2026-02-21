import { useState, useEffect, useRef, useCallback } from 'react'

interface UseRestTimerOptions {
  onComplete?: () => void
}

export function useRestTimer(options: UseRestTimerOptions = {}) {
  const [remaining, setRemaining] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const endTimeRef = useRef(0)
  const onCompleteRef = useRef(options.onComplete)

  // Keep the callback ref up-to-date without triggering effect re-runs
  useEffect(() => {
    onCompleteRef.current = options.onComplete
  }, [options.onComplete])

  const start = useCallback((seconds: number) => {
    endTimeRef.current = Date.now() + seconds * 1000
    setRemaining(seconds)
    setIsRunning(true)
  }, [])

  const stop = useCallback(() => {
    setIsRunning(false)
    setRemaining(0)
  }, [])

  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      const now = Date.now()
      const left = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000))
      setRemaining(left)

      if (left <= 0) {
        clearInterval(interval)
        setIsRunning(false)
        onCompleteRef.current?.()
      }
    }, 250) // Update 4x/sec for smooth display, drift-corrected via endTime

    return () => clearInterval(interval)
  }, [isRunning])

  return { remaining, isRunning, start, stop }
}
