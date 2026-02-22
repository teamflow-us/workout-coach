import { useState, useEffect, useCallback } from 'react'
import type { FoodLogEntry, NutritionGoals, DailyTotals, MealType, MacroData } from '../../shared/types/nutrition.js'

const DEFAULT_GOALS: NutritionGoals = {
  caloriesTarget: 2000,
  proteinTarget: 150,
  carbsTarget: 200,
  fatTarget: 65,
  fiberTarget: 30,
}

const EMPTY_TOTALS: DailyTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  sodium: 0,
  byMeal: {
    breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    lunch: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    dinner: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    snack: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  },
}

export function useNutrition(date: string) {
  const [entries, setEntries] = useState<FoodLogEntry[]>([])
  const [totals, setTotals] = useState<DailyTotals>(EMPTY_TOTALS)
  const [goals, setGoals] = useState<NutritionGoals>(DEFAULT_GOALS)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [logRes, totalsRes, goalsRes] = await Promise.all([
        fetch(`/api/nutrition/log?date=${date}`),
        fetch(`/api/nutrition/totals?date=${date}`),
        fetch('/api/nutrition/goals'),
      ])

      if (logRes.ok) {
        const logData = await logRes.json()
        setEntries(logData)
      }
      if (totalsRes.ok) {
        const totalsData = await totalsRes.json()
        setTotals(totalsData)
      }
      if (goalsRes.ok) {
        const goalsData = await goalsRes.json()
        setGoals(goalsData)
      }
    } catch (err) {
      console.error('Failed to load nutrition data:', err)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const addEntry = useCallback(async (mealType: MealType, food: MacroData, servings: number) => {
    try {
      const res = await fetch('/api/nutrition/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loggedAt: date,
          mealType,
          foodName: food.name,
          brand: food.brand,
          servingSize: food.servingSize,
          servings,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          fiber: food.fiber,
          sugar: food.sugar,
          sodium: food.sodium,
          source: food.source,
          sourceId: food.sourceId,
        }),
      })

      if (!res.ok) throw new Error(`Failed: ${res.status}`)

      await fetchData()
    } catch (err) {
      console.error('Failed to add food entry:', err)
    }
  }, [date, fetchData])

  const deleteEntry = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/nutrition/log/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      await fetchData()
    } catch (err) {
      console.error('Failed to delete food entry:', err)
    }
  }, [fetchData])

  const entriesForMeal = useCallback((meal: MealType) => {
    return entries.filter((e) => e.mealType === meal)
  }, [entries])

  const mealCalories = useCallback((meal: MealType) => {
    return totals.byMeal[meal]?.calories ?? 0
  }, [totals])

  return {
    entries,
    totals,
    goals,
    loading,
    addEntry,
    deleteEntry,
    entriesForMeal,
    mealCalories,
    refresh: fetchData,
  }
}
