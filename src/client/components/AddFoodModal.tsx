import { useState, useCallback, useEffect, useRef } from 'react'
import type { MealType } from '../../shared/types/nutrition.js'

interface QuickAddInputProps {
  mealType: MealType
  onAdd: (mealType: MealType, foodName: string) => void
}

export default function QuickAddInput({ mealType, onAdd }: QuickAddInputProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(mealType, trimmed)
    setValue('')
    // Stay open for rapid multi-add
  }, [value, mealType, onAdd])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      setOpen(false)
      setValue('')
    }
  }, [handleSubmit])

  if (!open) {
    return (
      <button
        className="meal-add-btn"
        onClick={() => setOpen(true)}
        type="button"
      >
        + Add Food
      </button>
    )
  }

  return (
    <div className="quick-add-row">
      <input
        ref={inputRef}
        className="quick-add-input"
        type="text"
        placeholder="e.g. grilled chicken breast"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        className="quick-add-submit btn-primary"
        onClick={handleSubmit}
        disabled={!value.trim()}
        type="button"
      >
        Add
      </button>
      <button
        className="quick-add-cancel btn-secondary"
        onClick={() => { setOpen(false); setValue('') }}
        type="button"
      >
        X
      </button>
    </div>
  )
}
