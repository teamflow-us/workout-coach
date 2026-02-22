import type { MacroData } from '../../shared/types/nutrition.js'

const USDA_API_KEY = process.env.USDA_API_KEY || ''
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'
const OFF_BASE = 'https://world.openfoodfacts.org/api/v2'
const USER_AGENT = 'Gymini/1.0 (workout-coach)'

// USDA nutrient IDs
const NUTRIENT_IDS = {
  PROTEIN: 203,
  FAT: 204,
  CARBS: 205,
  CALORIES: 208,
  FIBER: 291,
  SUGAR: 269,
  SODIUM: 307,
} as const

function extractUSDANutrient(nutrients: Array<{ nutrientId?: number; nutrientNumber?: string; value?: number }>, id: number): number {
  const found = nutrients.find(
    (n) => n.nutrientId === id || n.nutrientNumber === String(id)
  )
  return found?.value ?? 0
}

export async function searchUSDA(query: string, pageSize = 15): Promise<MacroData[]> {
  if (!USDA_API_KEY) return []

  const params = new URLSearchParams({
    api_key: USDA_API_KEY,
    query,
    pageSize: String(pageSize),
    dataType: 'SR Legacy,Foundation,Branded',
    nutrients: Object.values(NUTRIENT_IDS).join(','),
  })

  const res = await fetch(`${USDA_BASE}/foods/search?${params}`)
  if (!res.ok) {
    console.error('USDA search error:', res.status)
    return []
  }

  const data = await res.json()
  const foods: MacroData[] = (data.foods ?? []).map((food: {
    fdcId: number
    description: string
    brandName?: string
    brandOwner?: string
    servingSize?: number
    servingSizeUnit?: string
    householdServingFullText?: string
    foodNutrients?: Array<{ nutrientId: number; nutrientNumber: string; value: number }>
  }) => {
    const nutrients = food.foodNutrients ?? []
    return {
      name: food.description,
      brand: food.brandName || food.brandOwner || null,
      servingSize: food.householdServingFullText || (food.servingSize ? `${food.servingSize}${food.servingSizeUnit || 'g'}` : null),
      servingWeight: food.servingSize ?? null,
      calories: extractUSDANutrient(nutrients, NUTRIENT_IDS.CALORIES),
      protein: extractUSDANutrient(nutrients, NUTRIENT_IDS.PROTEIN),
      carbs: extractUSDANutrient(nutrients, NUTRIENT_IDS.CARBS),
      fat: extractUSDANutrient(nutrients, NUTRIENT_IDS.FAT),
      fiber: extractUSDANutrient(nutrients, NUTRIENT_IDS.FIBER),
      sugar: extractUSDANutrient(nutrients, NUTRIENT_IDS.SUGAR),
      sodium: extractUSDANutrient(nutrients, NUTRIENT_IDS.SODIUM),
      source: 'usda' as const,
      sourceId: String(food.fdcId),
    }
  })

  return foods
}

export async function getUSDAFood(fdcId: string): Promise<MacroData | null> {
  if (!USDA_API_KEY) return null

  const res = await fetch(`${USDA_BASE}/food/${fdcId}?api_key=${USDA_API_KEY}`)
  if (!res.ok) return null

  const food = await res.json()
  const nutrients = food.foodNutrients ?? []

  return {
    name: food.description,
    brand: food.brandName || food.brandOwner || null,
    servingSize: food.householdServingFullText || (food.servingSize ? `${food.servingSize}${food.servingSizeUnit || 'g'}` : null),
    servingWeight: food.servingSize ?? null,
    calories: extractUSDANutrient(nutrients, NUTRIENT_IDS.CALORIES),
    protein: extractUSDANutrient(nutrients, NUTRIENT_IDS.PROTEIN),
    carbs: extractUSDANutrient(nutrients, NUTRIENT_IDS.CARBS),
    fat: extractUSDANutrient(nutrients, NUTRIENT_IDS.FAT),
    fiber: extractUSDANutrient(nutrients, NUTRIENT_IDS.FIBER),
    sugar: extractUSDANutrient(nutrients, NUTRIENT_IDS.SUGAR),
    sodium: extractUSDANutrient(nutrients, NUTRIENT_IDS.SODIUM),
    source: 'usda',
    sourceId: String(food.fdcId),
  }
}

function parseOFFNutrients(product: Record<string, unknown>): {
  calories: number; protein: number; carbs: number; fat: number
  fiber: number; sugar: number; sodium: number
} {
  const n = (product.nutriments ?? {}) as Record<string, number | undefined>

  // Prefer per-serving values, fall back to per-100g
  return {
    calories: n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? 0,
    protein: n['proteins_serving'] ?? n['proteins_100g'] ?? 0,
    carbs: n['carbohydrates_serving'] ?? n['carbohydrates_100g'] ?? 0,
    fat: n['fat_serving'] ?? n['fat_100g'] ?? 0,
    fiber: n['fiber_serving'] ?? n['fiber_100g'] ?? 0,
    sugar: n['sugars_serving'] ?? n['sugars_100g'] ?? 0,
    sodium: n['sodium_serving'] ?? n['sodium_100g'] ?? 0,
  }
}

export async function scanBarcode(barcode: string): Promise<MacroData | null> {
  const res = await fetch(`${OFF_BASE}/product/${barcode}.json`, {
    headers: { 'User-Agent': USER_AGENT },
  })

  if (!res.ok) return null

  const data = await res.json()
  if (data.status !== 1 || !data.product) return null

  const product = data.product as Record<string, unknown>
  const nutrients = parseOFFNutrients(product)

  return {
    name: (product.product_name as string) || 'Unknown Product',
    brand: (product.brands as string) || null,
    servingSize: (product.serving_size as string) || null,
    servingWeight: product.serving_quantity ? Number(product.serving_quantity) : null,
    ...nutrients,
    source: 'openfoodfacts',
    sourceId: barcode,
  }
}

export async function searchOFF(query: string, pageSize = 10): Promise<MacroData[]> {
  const params = new URLSearchParams({
    search_terms: query,
    page_size: String(pageSize),
    fields: 'code,product_name,brands,serving_size,serving_quantity,nutriments',
    json: '1',
  })

  const res = await fetch(`${OFF_BASE}/search?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
  })

  if (!res.ok) {
    console.error('Open Food Facts search error:', res.status)
    return []
  }

  const data = await res.json()
  const products = (data.products ?? []) as Array<Record<string, unknown>>

  return products
    .filter((p) => {
      const n = (p.nutriments ?? {}) as Record<string, number | undefined>
      return n['energy-kcal_100g'] != null || n['energy-kcal_serving'] != null
    })
    .map((product) => {
      const nutrients = parseOFFNutrients(product)
      return {
        name: (product.product_name as string) || 'Unknown Product',
        brand: (product.brands as string) || null,
        servingSize: (product.serving_size as string) || null,
        servingWeight: product.serving_quantity ? Number(product.serving_quantity) : null,
        ...nutrients,
        source: 'openfoodfacts' as const,
        sourceId: (product.code as string) || '',
      }
    })
}

export async function searchFood(query: string): Promise<MacroData[]> {
  const [usdaResult, offResult] = await Promise.allSettled([
    searchUSDA(query),
    searchOFF(query),
  ])

  const usdaFoods = usdaResult.status === 'fulfilled' ? usdaResult.value : []
  const offFoods = offResult.status === 'fulfilled' ? offResult.value : []

  // Merge: USDA first (more accurate for whole foods), then OFF
  return [...usdaFoods, ...offFoods]
}
