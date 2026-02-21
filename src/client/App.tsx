import { useState, useEffect } from 'react'

interface HealthResponse {
  status: string
  timestamp: string
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => setError(err.message))
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>William Workout</h1>
      <p>AI-powered workout coaching</p>

      <h2>API Status</h2>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {health ? (
        <p style={{ color: 'green' }}>
          Server: {health.status} (as of {health.timestamp})
        </p>
      ) : (
        !error && <p>Checking server health...</p>
      )}
    </div>
  )
}
