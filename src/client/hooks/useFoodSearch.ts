import { useState, useRef, useCallback } from 'react'
import type { MacroData } from '../../shared/types/nutrition.js'

export function useFoodSearch() {
  const [results, setResults] = useState<MacroData[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const search = useCallback((query: string) => {
    // Clear any pending debounce
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort()
    }

    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(
          `/api/nutrition/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        )

        if (!res.ok) throw new Error(`Search failed: ${res.status}`)

        const data: MacroData[] = await res.json()
        setResults(data)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Food search error:', err)
          setResults([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, 400)
  }, [])

  const searchBarcode = useCallback(async (barcode: string): Promise<MacroData | null> => {
    if (!barcode.trim()) return null

    setLoading(true)
    try {
      const res = await fetch(`/api/nutrition/barcode/${encodeURIComponent(barcode.trim())}`)
      if (!res.ok) return null

      const data: MacroData = await res.json()
      return data
    } catch (err) {
      console.error('Barcode scan error:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    setResults([])
    setLoading(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (abortRef.current) abortRef.current.abort()
  }, [])

  return { results, loading, search, searchBarcode, clear }
}
