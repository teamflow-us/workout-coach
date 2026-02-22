import { useState, useEffect, useCallback } from 'react'
import Chat from './components/Chat'
import WorkoutView from './components/WorkoutView'
import RestTimer from './components/RestTimer'
import ProfileEditor from './components/ProfileEditor'
import NutritionPage from './components/NutritionPage'
import { useWakeLock } from './hooks/useWakeLock'

type Tab = 'chat' | 'workout' | 'nutrition' | 'profile'
type ThemeMode = 'atelier' | 'midnight'

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [splashFading, setSplashFading] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'atelier'

    const storedTheme = window.localStorage.getItem('ww-theme')
    if (storedTheme === 'atelier' || storedTheme === 'midnight') {
      document.documentElement.setAttribute('data-theme', storedTheme)
      return storedTheme
    }

    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'midnight')
      return 'midnight'
    }

    document.documentElement.setAttribute('data-theme', 'atelier')
    return 'atelier'
  })
  const [saveToMemory, setSaveToMemory] = useState(true)
  const [restTimerSeconds, setRestTimerSeconds] = useState<number | null>(null)
  const [latestWorkoutId, setLatestWorkoutId] = useState<number | null>(null)
  const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock()

  useEffect(() => {
    window.localStorage.setItem('ww-theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Splash screen timer
  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFading(true), 1800)
    const hideTimer = setTimeout(() => setShowSplash(false), 2400)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  // Activate wake lock when Workout tab is active
  useEffect(() => {
    if (activeTab === 'workout') {
      requestWakeLock()
    } else {
      releaseWakeLock()
    }
  }, [activeTab, requestWakeLock, releaseWakeLock])

  const handleStartRest = useCallback((seconds: number) => {
    setRestTimerSeconds(seconds)
  }, [])

  const handleRestComplete = useCallback(() => {
    setRestTimerSeconds(null)
  }, [])

  // Called from Chat when a workout is generated -- switch to Workout tab
  const handleWorkoutGenerated = useCallback((workoutId: number) => {
    setLatestWorkoutId(workoutId)
    setActiveTab('workout')
  }, [])

  if (showSplash) {
    return (
      <div className={`splash-screen${splashFading ? ' fading' : ''}`}>
        <div className="splash-content">
          <div className="splash-icon">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 24h6v16H8V24Z" fill="currentColor" opacity="0.7" />
              <path d="M50 24h6v16h-6V24Z" fill="currentColor" opacity="0.7" />
              <path d="M14 20h4v24h-4V20Z" fill="currentColor" />
              <path d="M46 20h4v24h-4V20Z" fill="currentColor" />
              <rect x="18" y="29" width="28" height="6" rx="2" fill="currentColor" />
              <circle cx="32" cy="14" r="3" fill="currentColor" opacity="0.35" />
              <circle cx="32" cy="50" r="3" fill="currentColor" opacity="0.35" />
              <path d="M28 10l4 6 4-6" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.35" />
              <path d="M28 54l4-6 4 6" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.35" />
            </svg>
          </div>
          <h1 className="splash-title">Gymini</h1>
          <p className="splash-subtitle">Your AI Personal Trainer</p>
          <div className="splash-loader">
            <div className="splash-loader-bar" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container" data-theme={theme}>
      {activeTab === 'chat' && (
        <>
          <button
            className={`memory-toggle${saveToMemory ? ' active' : ''}`}
            onClick={() => setSaveToMemory((v) => !v)}
            type="button"
            aria-label={saveToMemory ? 'Memory saving is on' : 'Memory saving is off'}
          >
            Memory: {saveToMemory ? 'ON' : 'OFF'}
          </button>
          <button
            className="theme-toggle"
            onClick={() => setTheme(prev => (prev === 'atelier' ? 'midnight' : 'atelier'))}
            aria-label={theme === 'atelier' ? 'Switch to midnight theme' : 'Switch to atelier theme'}
          >
            <span className="theme-toggle-icon" aria-hidden>
              {theme === 'atelier' ? 'MOON' : 'SUN'}
            </span>
          </button>
        </>
      )}

      {/* Tab content area */}
      <div className="tab-content">
        {activeTab === 'chat' && (
          <Chat onWorkoutGenerated={handleWorkoutGenerated} saveToMemory={saveToMemory} />
        )}
        {activeTab === 'workout' && (
          <WorkoutView
            workoutId={latestWorkoutId}
            onStartRest={handleStartRest}
          />
        )}
        {activeTab === 'nutrition' && <NutritionPage />}
        {activeTab === 'profile' && <ProfileEditor />}
      </div>

      {/* Rest timer overlay */}
      {restTimerSeconds != null && (
        <RestTimer
          seconds={restTimerSeconds}
          onComplete={handleRestComplete}
        />
      )}

      {/* Bottom tab bar */}
      <div className="tab-bar bottom">
        <button
          className={`tab-button${activeTab === 'chat' ? ' active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <span className="tab-icon" aria-hidden>
            <svg viewBox="0 0 24 24" role="img">
              <path d="M4 5h16v10H8l-4 4V5Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="tab-text">Chat</span>
        </button>
        <button
          className={`tab-button${activeTab === 'workout' ? ' active' : ''}`}
          onClick={() => setActiveTab('workout')}
        >
          <span className="tab-icon" aria-hidden>
            <svg viewBox="0 0 24 24" role="img">
              <path d="M3 10h3v4H3v-4Zm15 0h3v4h-3v-4ZM7 11h10v2H7v-2Zm0-3h2v8H7V8Zm8 0h2v8h-2V8Z" fill="currentColor" />
            </svg>
          </span>
          <span className="tab-text">Workout</span>
        </button>
        <button
          className={`tab-button${activeTab === 'nutrition' ? ' active' : ''}`}
          onClick={() => setActiveTab('nutrition')}
        >
          <span className="tab-icon" aria-hidden>
            <svg viewBox="0 0 24 24" role="img">
              <path d="M12 2C9.5 2 8 4 8 6c0 3 4 7 4 7s4-4 4-7c0-2-1.5-4-4-4Zm0 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM5 15c0-1 1-2 3-2.5.7.9 1.5 1.7 2.2 2.3L9 17H5v-2Zm14 0v2h-4l-1.2-2.2c.7-.6 1.5-1.4 2.2-2.3 2 .5 3 1.5 3 2.5ZM5 19h14v2H5v-2Z" fill="currentColor" />
            </svg>
          </span>
          <span className="tab-text">Nutrition</span>
        </button>
        <button
          className={`tab-button${activeTab === 'profile' ? ' active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span className="tab-icon" aria-hidden>
            <svg viewBox="0 0 24 24" role="img">
              <path d="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 10c4.42 0 8 2.24 8 5v1H4v-1c0-2.76 3.58-5 8-5Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="tab-text">Profile</span>
        </button>
      </div>
    </div>
  )
}
