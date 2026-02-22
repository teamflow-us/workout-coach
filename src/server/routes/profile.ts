import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { coachingProfiles } from '../db/schema.js'

const app = new Hono()

// ---------- GET / -- Return the coaching profile ----------

app.get('/', async (c) => {
  const profile = await db.query.coachingProfiles.findFirst()

  if (!profile) {
    // Return a default empty profile if none exists
    return c.json({
      id: null,
      biometrics: {},
      maxes: {},
      injuries: [],
      equipment: [],
      dietaryConstraints: [],
      preferences: {},
      updatedAt: null,
    })
  }

  // Parse JSON fields for the response
  return c.json({
    id: profile.id,
    biometrics: JSON.parse(profile.biometrics),
    maxes: JSON.parse(profile.maxes),
    injuries: JSON.parse(profile.injuries),
    equipment: JSON.parse(profile.equipment),
    dietaryConstraints: JSON.parse(profile.dietaryConstraints),
    preferences: JSON.parse(profile.preferences),
    updatedAt: profile.updatedAt,
  })
})

// ---------- PUT / -- Upsert the coaching profile ----------

app.put('/', async (c) => {
  let body: {
    biometrics?: Record<string, unknown>
    maxes?: Record<string, number>
    injuries?: string[]
    equipment?: string[]
    dietaryConstraints?: string[]
    preferences?: Record<string, unknown>
  }

  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const existing = await db.query.coachingProfiles.findFirst()

  const values = {
    biometrics: JSON.stringify(body.biometrics ?? {}),
    maxes: JSON.stringify(body.maxes ?? {}),
    injuries: JSON.stringify(body.injuries ?? []),
    equipment: JSON.stringify(body.equipment ?? []),
    dietaryConstraints: JSON.stringify(body.dietaryConstraints ?? []),
    preferences: JSON.stringify(body.preferences ?? {}),
    updatedAt: new Date().toISOString(),
  }

  if (existing) {
    // Update existing profile
    await db
      .update(coachingProfiles)
      .set(values)
      .where(eq(coachingProfiles.id, existing.id))
  } else {
    // Insert new profile
    await db.insert(coachingProfiles).values(values)
  }

  // Return the updated profile
  const updated = await db.query.coachingProfiles.findFirst()
  return c.json({
    id: updated!.id,
    biometrics: JSON.parse(updated!.biometrics),
    maxes: JSON.parse(updated!.maxes),
    injuries: JSON.parse(updated!.injuries),
    equipment: JSON.parse(updated!.equipment),
    dietaryConstraints: JSON.parse(updated!.dietaryConstraints),
    preferences: JSON.parse(updated!.preferences),
    updatedAt: updated!.updatedAt,
  })
})

export default app
