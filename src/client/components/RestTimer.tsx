import { useEffect } from 'react'
import { useRestTimer } from '../hooks/useRestTimer'

interface RestTimerProps {
  seconds: number
  onComplete: () => void
}

export default function RestTimer({ seconds, onComplete }: RestTimerProps) {
  const { remaining, isRunning, start, stop } = useRestTimer({
    onComplete,
  })

  // Start the timer when the component mounts with the given seconds
  useEffect(() => {
    if (seconds > 0) {
      start(seconds)
    }
  }, [seconds, start])

  const handleSkip = () => {
    stop()
    onComplete()
  }

  // Format time display
  const formatTime = (secs: number): string => {
    if (secs >= 60) {
      const mins = Math.floor(secs / 60)
      const s = secs % 60
      return `${mins}:${s.toString().padStart(2, '0')}`
    }
    return `${secs}`
  }

  // Color based on remaining time
  const getTimerColor = (): string => {
    if (remaining <= 10) return 'var(--color-danger)'
    if (remaining <= 30) return 'var(--color-warning)'
    return 'var(--color-success)'
  }

  if (!isRunning && remaining === 0) return null

  return (
    <div className="rest-timer-overlay">
      <div className="rest-timer">
        <p className="rest-timer-label">Rest</p>
        <p className="rest-timer-time" style={{ color: getTimerColor() }}>
          {formatTime(remaining)}
        </p>
        <button
          className="btn-secondary tap-target rest-timer-skip"
          onClick={handleSkip}
        >
          Skip
        </button>
      </div>
    </div>
  )
}
