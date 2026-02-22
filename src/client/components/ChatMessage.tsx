interface ChatSource {
  date: string
  snippet: string
  score: number
}

interface ChatMessageProps {
  role: 'user' | 'model'
  text: string
  timestamp: number
  isStreaming?: boolean
  sources?: ChatSource[]
  animate?: boolean
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

function truncateSnippet(snippet: string, maxLen = 150): string {
  if (snippet.length <= maxLen) return snippet
  return snippet.slice(0, maxLen).trimEnd() + '...'
}

export default function ChatMessage({
  role,
  text,
  timestamp,
  isStreaming,
  sources,
  animate = true,
}: ChatMessageProps) {
  return (
    <div className={`chat-message ${role}${animate ? '' : ' no-animate'}`}>
      <div>{formatText(text)}</div>
      {role === 'model' && sources && sources.length > 0 && !isStreaming && (
        <details className="chat-sources">
          <summary className="chat-sources-summary">
            Sources used ({sources.length})
          </summary>
          <div className="chat-sources-list">
            {sources.map((source, idx) => (
              <div key={idx} className="chat-source-item">
                <div className="chat-source-header">
                  {source.date} ({source.score}% relevant)
                </div>
                <div className="chat-source-snippet">
                  {truncateSnippet(source.snippet)}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
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
