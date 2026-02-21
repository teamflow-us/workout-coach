import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index.js'
import { workouts, exercises, sets } from '../db/schema.js'

const app = new Hono()

// ---------- Validation Schemas ----------

const createSetSchema = z.object({
  setNumber: z.number().int().positive(),
  reps: z.number().int().positive().nullable().optional(),
  weight: z.number().nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  notes: z.string().nullable().optional(),
})

const createExerciseSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().positive(),
  sets: z.array(createSetSchema).optional().default([]),
})

const createWorkoutSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  programName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  feedback: z.string().nullable().optional(),
  exercises: z.array(createExerciseSchema).optional().default([]),
})

// ---------- Routes ----------

/**
 * GET / - List all workouts, ordered by date descending
 */
app.get('/', async (c) => {
  const allWorkouts = await db
    .select()
    .from(workouts)
    .orderBy(desc(workouts.date))

  return c.json(allWorkouts)
})

/**
 * GET /:id - Get a single workout by ID with nested exercises and sets
 */
app.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))

  if (isNaN(id)) {
    return c.json({ error: 'Invalid workout ID' }, 400)
  }

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, id),
    with: {
      exercises: {
        with: {
          sets: true,
        },
      },
    },
  })

  if (!workout) {
    return c.json({ error: 'Workout not found' }, 404)
  }

  return c.json(workout)
})

/**
 * POST / - Create a new workout with exercises and sets
 * Uses a transaction to ensure atomicity
 */
app.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = createWorkoutSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: 'Validation failed', details: parsed.error.format() },
      400
    )
  }

  const data = parsed.data

  // Use a transaction to insert workout + exercises + sets atomically
  const result = db.transaction((tx) => {
    // Insert workout
    const insertedWorkout = tx
      .insert(workouts)
      .values({
        date: data.date,
        programName: data.programName ?? null,
        notes: data.notes ?? null,
        feedback: data.feedback ?? null,
      })
      .returning()
      .get()

    // Insert exercises and their sets
    for (const exercise of data.exercises) {
      const insertedExercise = tx
        .insert(exercises)
        .values({
          workoutId: insertedWorkout.id,
          name: exercise.name,
          order: exercise.order,
        })
        .returning()
        .get()

      for (const set of exercise.sets) {
        tx.insert(sets)
          .values({
            exerciseId: insertedExercise.id,
            setNumber: set.setNumber,
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            rpe: set.rpe ?? null,
            notes: set.notes ?? null,
          })
          .run()
      }
    }

    return insertedWorkout
  })

  return c.json(result, 201)
})

export default app
