import { useState, useEffect, useCallback, useRef } from 'react'
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
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
    }
  }, [date])

  useEffect(() => {
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  // Poll when any entry is pending
  useEffect(() => {
    const hasPending = entries.some((e) => e.status === 'pending')

    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(() => {
        fetchData()
      }, 3000)
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [entries, fetchData])

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

  const quickAdd = useCallback(async (mealType: MealType, foodName: string) => {
    // Optimistically add a pending entry
    const tempEntry: FoodLogEntry = {
      id: -Date.now(), // temporary negative ID
      loggedAt: date,
      mealType,
      foodName,
      brand: null,
      servingSize: null,
      servings: 1,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      source: 'gemini',
      sourceId: `quick-${Date.now()}`,
      status: 'pending',
    }

    setEntries((prev) => [tempEntry, ...prev])

    try {
      const res = await fetch('/api/nutrition/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodName, mealType, loggedAt: date }),
      })

      if (!res.ok) throw new Error(`Failed: ${res.status}`)

      // Replace temp entry with real server entry
      const created: FoodLogEntry = await res.json()
      setEntries((prev) =>
        prev.map((e) => (e.id === tempEntry.id ? created : e))
      )
    } catch (err) {
      console.error('Quick add failed:', err)
      // Remove the optimistic entry on failure
      setEntries((prev) => prev.filter((e) => e.id !== tempEntry.id))
    }
  }, [date])

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
    quickAdd,
    deleteEntry,
    entriesForMeal,
    mealCalories,
    refresh: fetchData,
  }
}
