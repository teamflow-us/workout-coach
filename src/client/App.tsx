import { useState, useEffect, useCallback } from 'react'
import Chat from './components/Chat'
import WorkoutView from './components/WorkoutView'
import RestTimer from './components/RestTimer'
import ProfileEditor from './components/ProfileEditor'
import { useWakeLock } from './hooks/useWakeLock'

type Tab = 'chat' | 'workout' | 'profile'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [restTimerSeconds, setRestTimerSeconds] = useState<number | null>(null)
  const [latestWorkoutId, setLatestWorkoutId] = useState<number | null>(null)
  const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock()

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

  return (
    <div className="app-container">
      {/* Tab content area */}
      <div className="tab-content">
        {activeTab === 'chat' && (
          <Chat onWorkoutGenerated={handleWorkoutGenerated} />
        )}
        {activeTab === 'workout' && (
          <WorkoutView
            workoutId={latestWorkoutId}
            onStartRest={handleStartRest}
          />
        )}
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
          Chat
        </button>
        <button
          className={`tab-button${activeTab === 'workout' ? ' active' : ''}`}
          onClick={() => setActiveTab('workout')}
        >
          Workout
        </button>
        <button
          className={`tab-button${activeTab === 'profile' ? ' active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
      </div>
    </div>
  )
}
