import { Hono } from 'hono'
import { eq, desc, sql, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index.js'
import { foodLog, nutritionGoals, favoriteFoods } from '../db/schema.js'
import { searchFood, scanBarcode } from '../lib/nutrition.js'
import type { MealType, DailyTotals } from '../../shared/types/nutrition.js'

const app = new Hono()

// ---------- Validation Schemas ----------

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const

const addLogSchema = z.object({
  loggedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  mealType: z.enum(mealTypes),
  foodName: z.string().min(1),
  brand: z.string().nullable().optional(),
  servingSize: z.string().nullable().optional(),
  servings: z.number().positive().default(1),
  calories: z.number().default(0),
  protein: z.number().default(0),
  carbs: z.number().default(0),
  fat: z.number().default(0),
  fiber: z.number().default(0),
  sugar: z.number().default(0),
  sodium: z.number().default(0),
  source: z.enum(['usda', 'openfoodfacts', 'gemini']),
  sourceId: z.string().min(1),
})

const goalsSchema = z.object({
  caloriesTarget: z.number().int().positive(),
  proteinTarget: z.number().int().positive(),
  carbsTarget: z.number().int().positive(),
  fatTarget: z.number().int().positive(),
  fiberTarget: z.number().int().positive(),
})

// ---------- Routes ----------

/**
 * GET /search?q=chicken - Unified food search
 */
app.get('/search', async (c) => {
  const query = c.req.query('q')
  if (!query || query.trim().length === 0) {
    return c.json({ error: 'Query parameter "q" is required' }, 400)
  }

  try {
    const results = await searchFood(query.trim())
    return c.json(results)
  } catch (err) {
    console.error('Food search error:', err)
    return c.json({ error: 'Search failed' }, 500)
  }
})

/**
 * GET /barcode/:code - Open Food Facts barcode lookup
 */
app.get('/barcode/:code', async (c) => {
  const code = c.req.param('code')

  try {
    const result = await scanBarcode(code)
    if (!result) {
      return c.json({ error: 'Product not found' }, 404)
    }
    return c.json(result)
  } catch (err) {
    console.error('Barcode scan error:', err)
    return c.json({ error: 'Barcode lookup failed' }, 500)
  }
})

/**
 * GET /log?date=YYYY-MM-DD - Get day's food log entries (default today)
 */
app.get('/log', async (c) => {
  const date = c.req.query('date') || new Date().toISOString().slice(0, 10)

  const entries = await db
    .select()
    .from(foodLog)
    .where(eq(foodLog.loggedAt, date))
    .orderBy(desc(foodLog.createdAt))

  return c.json(entries)
})

/**
 * POST /log - Add food log entry + upsert into favorites
 */
app.post('/log', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = addLogSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: 'Validation failed', details: parsed.error.format() },
      400
    )
  }

  const data = parsed.data

  const result = db.transaction((tx) => {
    // Insert food log entry
    const entry = tx
      .insert(foodLog)
      .values({
        loggedAt: data.loggedAt,
        mealType: data.mealType,
        foodName: data.foodName,
        brand: data.brand ?? null,
        servingSize: data.servingSize ?? null,
        servings: data.servings,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        fiber: data.fiber,
        sugar: data.sugar,
        sodium: data.sodium,
        source: data.source,
        sourceId: data.sourceId,
      })
      .returning()
      .get()

    // Upsert favorite: increment useCount if exists, otherwise insert
    const existing = tx
      .select()
      .from(favoriteFoods)
      .where(
        and(
          eq(favoriteFoods.source, data.source),
          eq(favoriteFoods.sourceId, data.sourceId),
        )
      )
      .get()

    if (existing) {
      tx.update(favoriteFoods)
        .set({ useCount: existing.useCount + 1 })
        .where(eq(favoriteFoods.id, existing.id))
        .run()
    } else {
      tx.insert(favoriteFoods)
        .values({
          foodName: data.foodName,
          brand: data.brand ?? null,
          servingSize: data.servingSize ?? null,
          calories: data.calories,
          protein: data.protein,
          carbs: data.carbs,
          fat: data.fat,
          fiber: data.fiber,
          sugar: data.sugar,
          sodium: data.sodium,
          source: data.source,
          sourceId: data.sourceId,
        })
        .run()
    }

    return entry
  })

  return c.json(result, 201)
})

/**
 * DELETE /log/:id - Delete a food log entry
 */
app.delete('/log/:id', async (c) => {
  const id = Number(c.req.param('id'))

  if (isNaN(id)) {
    return c.json({ error: 'Invalid log entry ID' }, 400)
  }

  const existing = await db
    .select()
    .from(foodLog)
    .where(eq(foodLog.id, id))
    .get()

  if (!existing) {
    return c.json({ error: 'Log entry not found' }, 404)
  }

  await db.delete(foodLog).where(eq(foodLog.id, id)).run()

  return c.json({ success: true })
})

/**
 * GET /totals?date=YYYY-MM-DD - Aggregated daily macro totals grouped by meal
 */
app.get('/totals', async (c) => {
  const date = c.req.query('date') || new Date().toISOString().slice(0, 10)

  const entries = await db
    .select()
    .from(foodLog)
    .where(eq(foodLog.loggedAt, date))

  const totals: DailyTotals = {
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

  for (const entry of entries) {
    const s = entry.servings
    totals.calories += entry.calories * s
    totals.protein += entry.protein * s
    totals.carbs += entry.carbs * s
    totals.fat += entry.fat * s
    totals.fiber += entry.fiber * s
    totals.sugar += entry.sugar * s
    totals.sodium += entry.sodium * s

    const meal = entry.mealType as MealType
    if (totals.byMeal[meal]) {
      totals.byMeal[meal].calories += entry.calories * s
      totals.byMeal[meal].protein += entry.protein * s
      totals.byMeal[meal].carbs += entry.carbs * s
      totals.byMeal[meal].fat += entry.fat * s
    }
  }

  return c.json(totals)
})

/**
 * GET /goals - Get macro goals (return defaults if none set)
 */
app.get('/goals', async (c) => {
  const goals = await db.select().from(nutritionGoals).get()

  if (!goals) {
    return c.json({
      caloriesTarget: 2000,
      proteinTarget: 150,
      carbsTarget: 200,
      fatTarget: 65,
      fiberTarget: 30,
    })
  }

  return c.json({
    caloriesTarget: goals.caloriesTarget,
    proteinTarget: goals.proteinTarget,
    carbsTarget: goals.carbsTarget,
    fatTarget: goals.fatTarget,
    fiberTarget: goals.fiberTarget,
  })
})

/**
 * PUT /goals - Create or update macro goals
 */
app.put('/goals', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = goalsSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: 'Validation failed', details: parsed.error.format() },
      400
    )
  }

  const data = parsed.data
  const existing = await db.select().from(nutritionGoals).get()

  const values = {
    caloriesTarget: data.caloriesTarget,
    proteinTarget: data.proteinTarget,
    carbsTarget: data.carbsTarget,
    fatTarget: data.fatTarget,
    fiberTarget: data.fiberTarget,
    updatedAt: new Date().toISOString(),
  }

  if (existing) {
    await db
      .update(nutritionGoals)
      .set(values)
      .where(eq(nutritionGoals.id, existing.id))
  } else {
    await db.insert(nutritionGoals).values(values)
  }

  return c.json(data)
})

/**
 * GET /favorites - Get top 20 frequently used foods by useCount
 */
app.get('/favorites', async (c) => {
  const favorites = await db
    .select()
    .from(favoriteFoods)
    .orderBy(desc(favoriteFoods.useCount))
    .limit(20)

  return c.json(favorites)
})

export default app
