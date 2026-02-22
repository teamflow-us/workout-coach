import { useState, useRef, useEffect } from 'react'
import { useChat } from '../hooks/useChat'
import ChatMessage from './ChatMessage'

interface ChatProps {
  onWorkoutGenerated?: (workoutId: number) => void
  saveToMemory: boolean
}

export default function Chat({ onWorkoutGenerated, saveToMemory }: ChatProps) {
  const { messages, sendMessage, generateWorkout, isStreaming, historyLoaded } = useChat()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasScrolledToHistory = useRef(false)

  // Auto-scroll to bottom: instant on initial history load, smooth for new messages
  useEffect(() => {
    if (!historyLoaded) return

    if (!hasScrolledToHistory.current) {
      if (messages.length > 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
      }
      hasScrolledToHistory.current = true
    } else if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, historyLoaded])

  const handleSend = () => {
    if (!input.trim() || isStreaming) return
    sendMessage(input.trim(), saveToMemory)
    setInput('')
    // Re-focus input after sending
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleGenerateWorkout = async () => {
    if (isStreaming) return
    const result = await generateWorkout('Generate a workout for today based on my training history and goals', saveToMemory)
    if (result?.workout?.id && onWorkoutGenerated) {
      onWorkoutGenerated(result.workout.id)
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {!historyLoaded ? (
          <div className="chat-skeleton">
            <div className="skeleton-msg skeleton-user" />
            <div className="skeleton-msg skeleton-model skeleton-wide" />
            <div className="skeleton-msg skeleton-user skeleton-narrow" />
            <div className="skeleton-msg skeleton-model" />
            <div className="skeleton-msg skeleton-user" />
            <div className="skeleton-msg skeleton-model skeleton-wide" />
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-messages-empty">
            Start a conversation with your AI coach
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatMessage
              key={idx}
              role={msg.role}
              text={msg.text}
              timestamp={msg.timestamp}
              sources={msg.sources}
              isStreaming={
                isStreaming && idx === messages.length - 1 && msg.role === 'model'
              }
              animate={hasScrolledToHistory.current}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-bar">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 'var(--spacing-sm)' }}>
          <button
            className="btn-workout tap-target"
            onClick={handleGenerateWorkout}
            disabled={isStreaming}
          >
            Generate Workout
          </button>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <input
              ref={inputRef}
              className="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isStreaming ? 'AI is responding...' : 'Message your coach...'}
              disabled={isStreaming}
              autoComplete="off"
            />
            <button
              className="btn-primary tap-target"
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
