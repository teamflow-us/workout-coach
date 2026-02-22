import { useState, useCallback } from 'react'
import { useNutrition } from '../hooks/useNutrition'
import MacroRings from './MacroRings'
import QuickAddInput from './AddFoodModal'
import type { MealType, FoodLogEntry } from '../../shared/types/nutrition.js'

const MEALS: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Breakfast' },
  { type: 'lunch', label: 'Lunch' },
  { type: 'dinner', label: 'Dinner' },
  { type: 'snack', label: 'Snack' },
]

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function displayDate(dateStr: string): string {
  const today = formatDate(new Date())
  if (dateStr === today) return 'Today'

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateStr === formatDate(yesterday)) return 'Yesterday'

  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function NutritionPage() {
  const [date, setDate] = useState(() => formatDate(new Date()))
  const { totals, goals, loading, quickAdd, deleteEntry, entriesForMeal, mealCalories } = useNutrition(date)

  const handlePrevDay = useCallback(() => {
    setDate((prev) => {
      const d = new Date(prev + 'T12:00:00')
      d.setDate(d.getDate() - 1)
      return formatDate(d)
    })
  }, [])

  const handleNextDay = useCallback(() => {
    setDate((prev) => {
      const d = new Date(prev + 'T12:00:00')
      d.setDate(d.getDate() + 1)
      return formatDate(d)
    })
  }, [])

  const handleDelete = useCallback(async (entry: FoodLogEntry) => {
    await deleteEntry(entry.id)
  }, [deleteEntry])

  return (
    <div className="nutrition-page">
      {/* Date navigation */}
      <div className="nutrition-date-nav">
        <button className="nutrition-date-btn btn-secondary" onClick={handlePrevDay} type="button">
          &larr;
        </button>
        <span className="nutrition-date-label">{displayDate(date)}</span>
        <button className="nutrition-date-btn btn-secondary" onClick={handleNextDay} type="button">
          &rarr;
        </button>
      </div>

      {loading ? (
        <div className="nutrition-loading">Loading...</div>
      ) : (
        <>
          {/* Macro rings */}
          <MacroRings totals={totals} goals={goals} />

          {/* Meal sections */}
          {MEALS.map(({ type, label }) => {
            const mealEntries = entriesForMeal(type)
            const cal = Math.round(mealCalories(type))

            return (
              <div key={type} className="meal-section">
                <div className="meal-header">
                  <h3 className="meal-title">{label}</h3>
                  {cal > 0 && (
                    <span className="meal-calories">{cal} cal</span>
                  )}
                </div>

                {mealEntries.length > 0 && (
                  <div className="meal-entries">
                    {mealEntries.map((entry: FoodLogEntry) => (
                      <div
                        key={entry.id}
                        className={`meal-entry${entry.status === 'pending' ? ' meal-entry-pending' : ''}${entry.status === 'failed' ? ' meal-entry-failed' : ''}`}
                      >
                        <div className="meal-entry-info">
                          <div className="meal-entry-name">
                            {entry.foodName}
                            {entry.servings !== 1 && entry.status === 'complete' && (
                              <span className="meal-entry-servings"> x{entry.servings}</span>
                            )}
                            {entry.status === 'pending' && (
                              <span className="meal-entry-badge pending">Pending</span>
                            )}
                            {entry.status === 'failed' && (
                              <span className="meal-entry-badge failed">Failed</span>
                            )}
                          </div>
                          {entry.status === 'complete' && (
                            <div className="meal-entry-macros">
                              {Math.round(entry.calories * entry.servings)} cal &middot;{' '}
                              {Math.round(entry.protein * entry.servings)}p &middot;{' '}
                              {Math.round(entry.carbs * entry.servings)}c &middot;{' '}
                              {Math.round(entry.fat * entry.servings)}f
                            </div>
                          )}
                          {entry.status === 'pending' && (
                            <div className="meal-entry-macros meal-entry-macros-pending">
                              Estimating macros...
                            </div>
                          )}
                          {entry.status === 'failed' && (
                            <div className="meal-entry-macros meal-entry-macros-failed">
                              Macros unavailable
                            </div>
                          )}
                        </div>
                        <button
                          className="meal-entry-delete"
                          onClick={() => handleDelete(entry)}
                          type="button"
                          aria-label={`Delete ${entry.foodName}`}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <QuickAddInput mealType={type} onAdd={quickAdd} />
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
