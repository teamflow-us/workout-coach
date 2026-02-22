interface ChatSource {
  date: string
  snippet: string
  score: number
}

interface NutritionLoggedItem {
  name: string
  mealType: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface ChatMessageProps {
  role: 'user' | 'model'
  text: string
  timestamp: number
  isStreaming?: boolean
  sources?: ChatSource[]
  nutritionLogged?: NutritionLoggedItem[]
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
  nutritionLogged,
  animate = true,
}: ChatMessageProps) {
  return (
    <div className={`chat-message ${role}${animate ? '' : ' no-animate'}`}>
      <div>{formatText(text)}</div>
      {role === 'model' && nutritionLogged && nutritionLogged.length > 0 && !isStreaming && (
        <div className="chat-nutrition-logged">
          <div className="chat-nutrition-logged-header">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Logged to Nutrition
          </div>
          <div className="chat-nutrition-logged-items">
            {nutritionLogged.map((item, idx) => (
              <div key={idx} className="chat-nutrition-logged-item">
                <span className="chat-nutrition-item-name">{item.name}</span>
                <span className="chat-nutrition-item-macros">
                  {item.calories}cal &middot; {item.protein}p &middot; {item.carbs}c &middot; {item.fat}f
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
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
