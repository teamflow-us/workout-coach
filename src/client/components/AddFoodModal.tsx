import { useState, useCallback, useEffect, useRef } from 'react'
import { useFoodSearch } from '../hooks/useFoodSearch'
import type { MacroData, MealType } from '../../shared/types/nutrition.js'

interface AddFoodModalProps {
  mealType: MealType
  onAdd: (meal: MealType, food: MacroData, servings: number) => Promise<void>
  onClose: () => void
}

const SERVING_PRESETS = [0.5, 1, 1.5, 2]

export default function AddFoodModal({ mealType, onAdd, onClose }: AddFoodModalProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<MacroData | null>(null)
  const [servings, setServings] = useState(1)
  const [adding, setAdding] = useState(false)
  const { results, loading, search, searchBarcode, clear } = useFoodSearch()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    setSelected(null)
    search(value)
  }, [search])

  const handleBarcodeScan = useCallback(async () => {
    const barcode = prompt('Enter barcode number:')
    if (!barcode) return

    const result = await searchBarcode(barcode)
    if (result) {
      setSelected(result)
      setServings(1)
    } else {
      alert('Product not found. Try a text search instead.')
    }
  }, [searchBarcode])

  const handleSelect = useCallback((food: MacroData) => {
    setSelected(food)
    setServings(1)
  }, [])

  const handleAdd = useCallback(async () => {
    if (!selected) return
    setAdding(true)
    try {
      await onAdd(mealType, selected, servings)
      onClose()
    } catch {
      setAdding(false)
    }
  }, [selected, servings, mealType, onAdd, onClose])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  const previewCalories = selected ? Math.round(selected.calories * servings) : 0
  const previewProtein = selected ? Math.round(selected.protein * servings) : 0
  const previewCarbs = selected ? Math.round(selected.carbs * servings) : 0
  const previewFat = selected ? Math.round(selected.fat * servings) : 0

  return (
    <div className="food-modal-overlay" onClick={handleBackdropClick}>
      <div className="food-modal">
        <div className="food-modal-header">
          <h3 className="food-modal-title">
            Add to {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
          </h3>
          <button className="food-modal-close" onClick={onClose} type="button">
            X
          </button>
        </div>

        {!selected ? (
          <>
            <div className="food-search-bar">
              <input
                ref={inputRef}
                className="food-search-input"
                type="text"
                placeholder="Search foods..."
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
              />
              <button
                className="food-barcode-btn btn-secondary"
                onClick={handleBarcodeScan}
                type="button"
              >
                Barcode
              </button>
            </div>

            <div className="food-results">
              {loading && (
                <div className="food-results-loading">Searching...</div>
              )}
              {!loading && query && results.length === 0 && (
                <div className="food-results-empty">No results found</div>
              )}
              {results.map((food: MacroData, i: number) => {
                const hasCal = food.calories > 0
                const hasDetailedMacros = food.protein > 0 || food.carbs > 0 || food.fat > 0
                return (
                  <button
                    key={`${food.source}-${food.sourceId}-${i}`}
                    className="food-result-item"
                    onClick={() => handleSelect(food)}
                    type="button"
                  >
                    <span className="food-result-content">
                      <span className="food-result-header">
                        <span className="food-result-info">
                          <span className="food-result-name">{food.name}</span>
                          {food.brand && (
                            <span className="food-result-brand">{food.brand}</span>
                          )}
                        </span>
                        {hasCal && (
                          <span className="food-result-cal">{Math.round(food.calories)}</span>
                        )}
                      </span>
                      {hasDetailedMacros ? (
                        <span className="food-result-macros">
                          <span className="food-result-macro-line">
                            {Math.round(food.protein)}p &middot; {Math.round(food.carbs)}c &middot; {Math.round(food.fat)}f
                          </span>
                          <span className={`food-result-source ${food.source}`}>
                            {food.source === 'gemini' ? 'Gemini' : food.source === 'usda' ? 'USDA' : 'OFF'}
                          </span>
                        </span>
                      ) : (
                        <span className={`food-result-source ${food.source}`}>
                          {food.source === 'gemini' ? 'Gemini' : food.source === 'usda' ? 'USDA' : 'OFF'}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="food-detail">
            <button
              className="food-detail-back"
              onClick={() => setSelected(null)}
              type="button"
            >
              &larr; Back to search
            </button>

            <div className="food-detail-name">{selected.name}</div>
            {selected.brand && (
              <div className="food-detail-brand">{selected.brand}</div>
            )}
            {selected.servingSize && (
              <div className="food-detail-serving">Serving: {selected.servingSize}</div>
            )}

            <div className="food-servings">
              <label className="food-servings-label">Servings</label>
              <div className="food-servings-presets">
                {SERVING_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    className={`food-serving-btn${servings === preset ? ' active' : ''}`}
                    onClick={() => setServings(preset)}
                    type="button"
                  >
                    {preset}x
                  </button>
                ))}
                <input
                  className="food-serving-input"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={servings}
                  onChange={(e) => setServings(Math.max(0.1, Number(e.target.value) || 0.1))}
                />
              </div>
            </div>

            <div className="food-preview">
              <div className="food-preview-row">
                <span>Calories</span>
                <strong>{previewCalories}</strong>
              </div>
              <div className="food-preview-row">
                <span>Protein</span>
                <strong>{previewProtein}g</strong>
              </div>
              <div className="food-preview-row">
                <span>Carbs</span>
                <strong>{previewCarbs}g</strong>
              </div>
              <div className="food-preview-row">
                <span>Fat</span>
                <strong>{previewFat}g</strong>
              </div>
            </div>

            <button
              className="btn-primary food-add-btn"
              onClick={handleAdd}
              disabled={adding}
              type="button"
            >
              {adding ? 'Adding...' : 'Add Food'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
