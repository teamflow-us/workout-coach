interface ChatMessageProps {
  role: 'user' | 'model'
  text: string
  timestamp: number
  isStreaming?: boolean
}

/**
 * Format basic markdown-like text into JSX.
 * Supports **bold** and newlines.
 */
function formatText(text: string) {
  if (!text) return null

  // Split by newlines first
  const lines = text.split('\n')

  return lines.map((line, lineIdx) => {
    // Process **bold** markers within each line
    const parts = line.split(/(\*\*[^*]+\*\*)/)
    const formatted = parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={partIdx}>{part.slice(2, -2)}</strong>
      }
      return part
    })

    return (
      <span key={lineIdx}>
        {lineIdx > 0 && <br />}
        {formatted}
      </span>
    )
  })
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function ChatMessage({
  role,
  text,
  timestamp,
  isStreaming,
}: ChatMessageProps) {
  return (
    <div className={`chat-message ${role}`}>
      <div>{formatText(text)}</div>
      {isStreaming && !text && (
        <div className="streaming-indicator">
          <div className="dot" />
          <div className="dot" />
          <div className="dot" />
        </div>
      )}
      {!isStreaming && text && (
        <div className="chat-message-time">{formatTime(timestamp)}</div>
      )}
    </div>
  )
}
