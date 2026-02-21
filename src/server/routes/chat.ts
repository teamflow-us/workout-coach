import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { messages, workouts, exercises, sets } from '../db/schema.js'
import { ai } from '../lib/gemini.js'
import {
  buildSystemPrompt,
  messagesToHistory,
} from '../lib/coaching.js'
import { validateWorkoutWeights } from '../lib/guardrails.js'

const app = new Hono()

// ---------- POST /send -- Streaming chat via SSE ----------

app.post('/send', async (c) => {
  let body: { message: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body.message || typeof body.message !== 'string') {
    return c.json({ error: 'message is required' }, 400)
  }

  // Load existing messages from DB for conversation history
  const dbMessages = await db
    .select()
    .from(messages)
    .orderBy(asc(messages.createdAt))

  const history = messagesToHistory(dbMessages)
  const systemPrompt = await buildSystemPrompt()

  return streamSSE(c, async (stream) => {
    try {
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: systemPrompt,
        },
        history,
      })

      const response = await chat.sendMessageStream({
        message: body.message,
      })

      let fullText = ''
      for await (const chunk of response) {
        const text = chunk.text
        if (text) {
          fullText += text
          await stream.writeSSE({
            data: JSON.stringify({ type: 'chunk', text }),
            event: 'message',
          })
        }
      }

      // Signal completion with full text
      await stream.writeSSE({
        data: JSON.stringify({ type: 'done', fullText }),
        event: 'message',
      })

      // Persist both user message and AI response to DB
      await db.insert(messages).values([
        { role: 'user', content: body.message },
        { role: 'model', content: fullText },
      ])
    } catch (err) {
      console.error('Chat streaming error:', err)
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        }),
        event: 'message',
      })
    }
  })
})

// ---------- POST /generate-workout -- Structured workout generation ----------

const workoutPlanSchema = z.object({
  programName: z
    .string()
    .describe('Name of the workout program, e.g. "Push Day A"'),
  exercises: z.array(
    z.object({
      name: z.string().describe('Exercise name, e.g. "Barbell Bench Press"'),
      sets: z.number().int().describe('Number of sets'),
      reps: z.number().int().describe('Target reps per set'),
      weight: z.number().describe('Weight in lbs'),
      restSeconds: z
        .number()
        .int()
        .describe('Rest between sets in seconds'),
      notes: z.string().optional().describe('Form cues or modifications'),
    })
  ),
  notes: z.string().optional().describe('General workout notes'),
})

app.post('/generate-workout', async (c) => {
  let body: { prompt: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body.prompt || typeof body.prompt !== 'string') {
    return c.json({ error: 'prompt is required' }, 400)
  }

  try {
    const systemPrompt = await buildSystemPrompt()

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: body.prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseJsonSchema: z.toJSONSchema(workoutPlanSchema),
      },
    })

    const plan = workoutPlanSchema.parse(JSON.parse(response.text!))

    // Load coaching profile for weight validation
    const profile = await db.query.coachingProfiles.findFirst()
    const maxes = profile ? JSON.parse(profile.maxes) : {}
    const warnings = validateWorkoutWeights(
      plan.exercises.map((ex) => ({ name: ex.name, weight: ex.weight })),
      maxes
    )

    // Save the workout to the database (transaction-based, matching existing pattern)
    const today = new Date().toISOString().split('T')[0]
    const savedWorkout = db.transaction((tx) => {
      const insertedWorkout = tx
        .insert(workouts)
        .values({
          date: today,
          programName: plan.programName,
          notes: plan.notes ?? null,
        })
        .returning()
        .get()

      for (let i = 0; i < plan.exercises.length; i++) {
        const exercise = plan.exercises[i]
        const insertedExercise = tx
          .insert(exercises)
          .values({
            workoutId: insertedWorkout.id,
            name: exercise.name,
            order: i + 1,
            restSeconds: exercise.restSeconds,
          })
          .returning()
          .get()

        // Create individual set records for each set count
        for (let s = 1; s <= exercise.sets; s++) {
          tx.insert(sets)
            .values({
              exerciseId: insertedExercise.id,
              setNumber: s,
              reps: exercise.reps,
              weight: exercise.weight,
              notes: exercise.notes ?? null,
            })
            .run()
        }
      }

      return insertedWorkout
    })

    // Persist the conversation exchange as messages
    await db.insert(messages).values([
      { role: 'user', content: body.prompt },
      {
        role: 'model',
        content: `Generated workout: ${plan.programName} with ${plan.exercises.length} exercises`,
        workoutId: savedWorkout.id,
      },
    ])

    return c.json({
      workout: savedWorkout,
      plan,
      warnings,
    })
  } catch (err) {
    console.error('Workout generation error:', err)
    return c.json(
      {
        error: 'Failed to generate workout',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      500
    )
  }
})

// ---------- GET /history -- Load chat history ----------

app.get('/history', async (c) => {
  const allMessages = await db
    .select()
    .from(messages)
    .orderBy(asc(messages.createdAt))

  return c.json(allMessages)
})

export default app
