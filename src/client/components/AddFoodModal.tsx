import { useState, useCallback, useEffect, useRef } from 'react'
import type { MealType } from '../../shared/types/nutrition.js'

interface QuickAddInputProps {
  mealType: MealType
  onAdd: (mealType: MealType, foodName: string) => void
  onPhotoAdd: (mealType: MealType, image: string, mimeType: string) => void
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data URL prefix to get raw base64
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function QuickAddInput({ mealType, onAdd, onPhotoAdd }: QuickAddInputProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoSubmitting, setPhotoSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingFileRef = useRef<{ base64: string; mimeType: string } | null>(null)

  useEffect(() => {
    if (open && !photoPreview) inputRef.current?.focus()
  }, [open, photoPreview])

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(mealType, trimmed)
    setValue('')
  }, [value, mealType, onAdd])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      setOpen(false)
      setValue('')
      setPhotoPreview(null)
      pendingFileRef.current = null
    }
  }, [handleSubmit])

  const handlePhotoClick = useCallback(() => {
    fileRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show preview
    const previewUrl = URL.createObjectURL(file)
    setPhotoPreview(previewUrl)

    // Convert to base64
    const base64 = await fileToBase64(file)
    pendingFileRef.current = { base64, mimeType: file.type }

    // Reset the file input so the same file can be re-selected
    e.target.value = ''
  }, [])

  const handlePhotoSubmit = useCallback(async () => {
    if (!pendingFileRef.current) return
    setPhotoSubmitting(true)
    const { base64, mimeType } = pendingFileRef.current
    onPhotoAdd(mealType, base64, mimeType)
    // Clean up
    setPhotoPreview(null)
    pendingFileRef.current = null
    setPhotoSubmitting(false)
    setOpen(false)
  }, [mealType, onPhotoAdd])

  const handlePhotoCancel = useCallback(() => {
    setPhotoPreview(null)
    pendingFileRef.current = null
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    setValue('')
    setPhotoPreview(null)
    pendingFileRef.current = null
  }, [])

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

  // Photo preview mode
  if (photoPreview) {
    return (
      <div className="photo-add-preview">
        <img src={photoPreview} alt="Food photo" className="photo-add-image" />
        <div className="photo-add-actions">
          <button
            className="btn-primary photo-add-submit"
            onClick={handlePhotoSubmit}
            disabled={photoSubmitting}
            type="button"
          >
            {photoSubmitting ? 'Analyzing...' : 'Analyze Photo'}
          </button>
          <button
            className="btn-secondary photo-add-retake"
            onClick={handlePhotoCancel}
            type="button"
          >
            Retake
          </button>
        </div>
      </div>
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
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button
        className="quick-add-photo btn-secondary"
        onClick={handlePhotoClick}
        type="button"
        aria-label="Take photo of food"
        title="Take photo or upload image"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </button>
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
        onClick={handleClose}
        type="button"
      >
        X
      </button>
    </div>
  )
}
