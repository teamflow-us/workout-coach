export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface MacroData {
  name: string
  brand: string | null
  servingSize: string | null
  servingWeight: number | null
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  source: 'usda' | 'openfoodfacts' | 'gemini'
  sourceId: string
}

export interface FoodLogEntry {
  id: number
  loggedAt: string // YYYY-MM-DD
  mealType: MealType
  foodName: string
  brand: string | null
  servingSize: string | null
  servings: number
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  source: 'usda' | 'openfoodfacts' | 'gemini'
  sourceId: string
}

export interface NutritionGoals {
  caloriesTarget: number
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
  fiberTarget: number
}

export interface DailyTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  byMeal: Record<MealType, {
    calories: number
    protein: number
    carbs: number
    fat: number
  }>
}
