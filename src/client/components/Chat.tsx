import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from '../hooks/useChat'
import { useVoiceInput } from '../hooks/useVoiceInput'
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

  const handleTranscript = useCallback((text: string) => {
    setInput((prev) => (prev ? prev + ' ' + text : text))
    inputRef.current?.focus()
  }, [])

  const { voiceState, error: voiceError, toggleRecording, clearError } = useVoiceInput(handleTranscript)

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
              nutritionLogged={msg.nutritionLogged}
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
          {voiceError && (
            <div className="voice-error" onClick={clearError} role="alert">
              {voiceError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
            <button
              className={`btn-voice tap-target${voiceState === 'recording' ? ' recording' : ''}${voiceState === 'transcribing' ? ' transcribing' : ''}`}
              onClick={toggleRecording}
              disabled={isStreaming || voiceState === 'transcribing'}
              aria-label={
                voiceState === 'recording'
                  ? 'Stop recording'
                  : voiceState === 'transcribing'
                    ? 'Transcribing...'
                    : 'Start voice message'
              }
              type="button"
            >
              {voiceState === 'recording' ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                  <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                </svg>
              ) : voiceState === 'transcribing' ? (
                <div className="voice-spinner" />
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                  <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
                  <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <input
              ref={inputRef}
              className="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                voiceState === 'recording'
                  ? 'Listening...'
                  : voiceState === 'transcribing'
                    ? 'Transcribing...'
                    : isStreaming
                      ? 'AI is responding...'
                      : 'Message your coach...'
              }
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
