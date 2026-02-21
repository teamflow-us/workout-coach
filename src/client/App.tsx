import { useState } from 'react'
import Chat from './components/Chat'

type Tab = 'chat' | 'workout'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat')

  return (
    <div className="app-container">
      <div className="tab-bar">
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
      </div>

      <div className="tab-content">
        {activeTab === 'chat' && <Chat />}
        {activeTab === 'workout' && (
          <div className="workout-placeholder">
            <h2>Workout View</h2>
            <p>Coming in Plan 02 -- the active workout display with rest timer and gym UX</p>
          </div>
        )}
      </div>
    </div>
  )
}
