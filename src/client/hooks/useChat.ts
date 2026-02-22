import { useState, useEffect, useRef, useCallback } from 'react'

export interface ChatSource {
  date: string
  snippet: string
  score: number
}

export interface NutritionLoggedItem {
  name: string
  mealType: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
  timestamp: number
  sources?: ChatSource[]
  nutritionLogged?: NutritionLoggedItem[]
}

interface GenerateWorkoutResponse {
  workout: { id: number; date: string; programName: string | null }
  plan: {
    programName: string
    exercises: Array<{
      name: string
      sets: number
      reps: number
      weight: number
      restSeconds: number
      notes?: string
    }>
    notes?: string
  }
  warnings: Array<{
    exercise: string
    weight: number
    max: number
    issue: string
  }>
  sources?: Array<{ date: string; snippet: string; score: number }>
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const pendingSourcesRef = useRef<ChatSource[] | null>(null)

  // Load chat history on mount
  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/chat/history')
      if (!res.ok) return

      const dbMessages: Array<{
        id: number
        role: string
        content: string
        nutritionLogged: string | null
        createdAt: string
      }> = await res.json()

      const loaded: ChatMessage[] = dbMessages.map((m) => {
        const msg: ChatMessage = {
          role: m.role as 'user' | 'model',
          text: m.content,
          timestamp: new Date(m.createdAt).getTime(),
        }
        if (m.nutritionLogged) {
          try {
            msg.nutritionLogged = JSON.parse(m.nutritionLogged)
          } catch {}
        }
        return msg
      })

      setMessages(loaded)
    } catch (err) {
      console.error('Failed to load chat history:', err)
    } finally {
      setHistoryLoaded(true)
    }
  }

  const sendMessage = useCallback(async (text: string, saveToMemory?: boolean) => {
    if (!text.trim()) return

    // Add user message immediately
    const userMsg: ChatMessage = {
      role: 'user',
      text,
      timestamp: Date.now(),
    }

    // Add empty AI message placeholder
    const aiMsg: ChatMessage = {
      role: 'model',
      text: '',
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg, aiMsg])
    setIsStreaming(true)
    pendingSourcesRef.current = null

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, saveToMemory: saveToMemory ?? true }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error(`Chat request failed: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const event of events) {
          const dataLine = event
            .split('\n')
            .find((l) => l.startsWith('data: '))
          if (!dataLine) continue

          try {
            const data = JSON.parse(dataLine.slice(6))

            if (data.type === 'chunk') {
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                updated[updated.length - 1] = {
                  ...last,
                  text: last.text + data.text,
                }
                return updated
              })
            }

            if (data.type === 'sources') {
              // Store sources; they'll be attached to the message on 'done'
              pendingSourcesRef.current = data.sources as ChatSource[]
            }

            if (data.type === 'nutrition_logged') {
              // Attach logged nutrition items to the AI message
              const items = data.items as NutritionLoggedItem[]
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                updated[updated.length - 1] = {
                  ...last,
                  nutritionLogged: items,
                }
                return updated
              })
            }

            if (data.type === 'done') {
              // Attach pending sources to the finalized AI message
              if (pendingSourcesRef.current) {
                const attachedSources = pendingSourcesRef.current
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  updated[updated.length - 1] = {
                    ...last,
                    sources: attachedSources,
                  }
                  return updated
                })
                pendingSourcesRef.current = null
              }
            }

            if (data.type === 'error') {
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                updated[updated.length - 1] = {
                  ...last,
                  text: `Error: ${data.message}`,
                }
                return updated
              })
            }
          } catch {
            // Skip malformed SSE events
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Chat streaming error:', err)
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = {
            ...last,
            text: 'Sorry, something went wrong. Please try again.',
          }
          return updated
        })
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [])

  const generateWorkout = useCallback(
    async (prompt: string, saveToMemory?: boolean): Promise<GenerateWorkoutResponse | null> => {
      try {
        // Add prompt as user message
        const userMsg: ChatMessage = {
          role: 'user',
          text: prompt,
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, userMsg])
        setIsStreaming(true)

        const res = await fetch('/api/chat/generate-workout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, saveToMemory: saveToMemory ?? true }),
        })

        if (!res.ok) {
          throw new Error(`Workout generation failed: ${res.status}`)
        }

        const data: GenerateWorkoutResponse = await res.json()

        // Add summary as AI message to local state
        const exerciseList = data.plan.exercises
          .map(
            (ex) =>
              `- ${ex.name}: ${ex.sets}x${ex.reps} @ ${ex.weight}lbs`
          )
          .join('\n')

        const aiMsg: ChatMessage = {
          role: 'model',
          text: `Generated **${data.plan.programName}**:\n\n${exerciseList}${data.plan.notes ? `\n\n${data.plan.notes}` : ''}${data.warnings.length > 0 ? `\n\nWarnings:\n${data.warnings.map((w) => `- ${w.issue}`).join('\n')}` : ''}`,
          timestamp: Date.now(),
          sources: data.sources ?? [],
        }
        setMessages((prev) => [...prev, aiMsg])

        return data
      } catch (err) {
        console.error('Workout generation error:', err)
        const errorMsg: ChatMessage = {
          role: 'model',
          text: 'Sorry, failed to generate workout. Please try again.',
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, errorMsg])
        return null
      } finally {
        setIsStreaming(false)
      }
    },
    []
  )

  return { messages, sendMessage, generateWorkout, isStreaming, historyLoaded }
}
