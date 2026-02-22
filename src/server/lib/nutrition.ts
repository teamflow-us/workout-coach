import type { MacroData } from '../../shared/types/nutrition.js'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2'
const USER_AGENT = 'Gymini/1.0 (workout-coach)'

export async function searchFood(query: string): Promise<MacroData[]> {
  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not set')
    return []
  }

  const prompt = `You are a nutrition database. Given the food query below, return a JSON array of matching food items with their nutritional information per standard serving.

For each item include:
- name: the food name
- brand: brand name if applicable, otherwise null
- servingSize: a human-readable serving size string (e.g. "1 cup (240ml)", "1 medium (118g)", "100g")
- servingWeight: serving weight in grams as a number, or null if unknown
- calories: calories per serving
- protein: grams of protein per serving
- carbs: grams of carbs per serving
- fat: grams of fat per serving
- fiber: grams of fiber per serving
- sugar: grams of sugar per serving
- sodium: milligrams of sodium per serving

Return 5-10 results that best match the query. Include common variations (e.g. for "chicken breast" include grilled, baked, raw, etc). Values should be realistic nutritional data.

IMPORTANT: Return ONLY a valid JSON array, no markdown, no code fences, no explanation.

Query: "${query}"`

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!res.ok) {
      console.error('Gemini API error:', res.status, await res.text())
      return []
    }

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return []

    const parsed = JSON.parse(text)
    const items = Array.isArray(parsed) ? parsed : []

    return items.map((item: Record<string, unknown>, i: number) => ({
      name: String(item.name || 'Unknown'),
      brand: item.brand ? String(item.brand) : null,
      servingSize: item.servingSize ? String(item.servingSize) : null,
      servingWeight: typeof item.servingWeight === 'number' ? item.servingWeight : null,
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fat: Number(item.fat) || 0,
      fiber: Number(item.fiber) || 0,
      sugar: Number(item.sugar) || 0,
      sodium: Number(item.sodium) || 0,
      source: 'gemini' as const,
      sourceId: `gemini-${Date.now()}-${i}`,
    }))
  } catch (err) {
    console.error('Gemini search error:', err)
    return []
  }
}

export interface ExtractedFoodItem {
  name: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  servings: number
  servingSize: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
}

/**
 * Analyze a chat message and extract food items if the user is reporting what they ate.
 * Returns null if the message isn't about food intake.
 */
export async function extractFoodFromMessage(message: string): Promise<ExtractedFoodItem[] | null> {
  if (!GEMINI_API_KEY) return null

  const hour = new Date().getHours()
  const defaultMeal = hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 20 ? 'dinner' : 'snack'

  const prompt = `Analyze this message from a fitness app user. Determine if they are reporting food they actually ate or drank.

If the user IS reporting food intake (e.g. "I had a chicken breast and rice for lunch", "just ate 2 eggs and toast", "had a protein shake after my workout"), extract each individual food item.

If the user is NOT reporting food intake (e.g. asking questions about nutrition, discussing diet plans, asking what they should eat, general conversation), return null.

For each food item, provide:
- name: specific food name (e.g. "Grilled Chicken Breast", not just "chicken")
- mealType: one of "breakfast", "lunch", "dinner", "snack" - infer from context, default to "${defaultMeal}"
- servings: number of servings (default 1)
- servingSize: human-readable serving size (e.g. "6 oz", "1 cup", "1 medium")
- calories: estimated calories per serving
- protein: grams of protein per serving
- carbs: grams of carbs per serving
- fat: grams of fat per serving
- fiber: grams of fiber per serving
- sugar: grams of sugar per serving
- sodium: milligrams of sodium per serving

Use realistic nutritional values. If the user specifies amounts (e.g. "200g chicken"), adjust the serving size accordingly.

Return a JSON object with this exact structure:
- If food was reported: { "found": true, "items": [...] }
- If no food reported: { "found": false, "items": [] }

Message: "${message.replace(/"/g, '\\"')}"`

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!res.ok) {
      console.error('Gemini extract error:', res.status)
      return null
    }

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null

    const parsed = JSON.parse(text)
    if (!parsed.found || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      return null
    }

    return parsed.items.map((item: Record<string, unknown>) => ({
      name: String(item.name || 'Unknown'),
      mealType: ['breakfast', 'lunch', 'dinner', 'snack'].includes(String(item.mealType))
        ? String(item.mealType) as ExtractedFoodItem['mealType']
        : defaultMeal,
      servings: Number(item.servings) || 1,
      servingSize: item.servingSize ? String(item.servingSize) : null,
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fat: Number(item.fat) || 0,
      fiber: Number(item.fiber) || 0,
      sugar: Number(item.sugar) || 0,
      sodium: Number(item.sodium) || 0,
    }))
  } catch (err) {
    console.error('Food extraction error:', err)
    return null
  }
}

// Keep barcode scanning via Open Food Facts (Gemini can't look up barcodes)
function parseOFFNutrients(product: Record<string, unknown>): {
  calories: number; protein: number; carbs: number; fat: number
  fiber: number; sugar: number; sodium: number
} {
  const n = (product.nutriments ?? {}) as Record<string, number | undefined>

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
