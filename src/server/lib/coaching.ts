import { db } from '../db/index.js'
import { workouts } from '../db/schema.js'
import { desc } from 'drizzle-orm'
import { retrieveRelevantSessions, type RetrievedSession } from './rag.js'

export interface BuildPromptResult {
  prompt: string
  sources: Array<{ date: string; snippet: string; score: number }>
}

/**
 * Build the system prompt for the AI coaching persona.
 * Includes the coaching profile (maxes, injuries, equipment, preferences),
 * recent workout history, and RAG-retrieved training context when available.
 *
 * When userMessage is provided, queries ChromaDB for relevant past sessions
 * and includes them in the system prompt. Falls back to Phase 2 behavior
 * (profile + recent workouts only) if ChromaDB is unavailable.
 */
export async function buildSystemPrompt(userMessage?: string): Promise<BuildPromptResult> {
  // Load coaching profile (single-row table)
  const profile = await db.query.coachingProfiles.findFirst()

  // Load last 5 workouts with full exercise/set detail
  const recentWorkouts = await db.query.workouts.findMany({
    orderBy: [desc(workouts.date)],
    limit: 5,
    with: {
      exercises: {
        with: { sets: true },
      },
    },
  })

  const profileSection = profile
    ? `## Coaching Profile
- Current maxes: ${profile.maxes}
- Injuries/limitations: ${profile.injuries}
- Available equipment: ${profile.equipment}
- Dietary constraints: ${profile.dietaryConstraints}
- Training preferences: ${profile.preferences}`
    : `## Coaching Profile
No profile set yet. Ask the user about their training background, current maxes, injuries, and available equipment.`

  const workoutSection =
    recentWorkouts.length > 0
      ? `## Recent Workouts\n${recentWorkouts.map((w) => formatWorkoutForContext(w)).join('\n\n')}`
      : `## Recent Workouts\nNo workouts recorded yet.`

  // RAG retrieval: fetch relevant past sessions when user message is provided
  let ragSection = ''
  let sources: Array<{ date: string; snippet: string; score: number }> = []

  if (userMessage) {
    try {
      const retrieved = await retrieveRelevantSessions(userMessage, 5)
      if (retrieved.length > 0) {
        sources = retrieved.map((r) => ({
          date: (r.metadata.date as string) || 'Unknown date',
          snippet: r.snippet,
          score: Math.round(r.score * 100),
        }))

        const sessionEntries = sources
          .map(
            (s) =>
              `### ${s.date} session (relevance: ${s.score}%)\n${s.snippet}`
          )
          .join('\n\n')

        ragSection = `\n\n## Relevant Training History (from memory)\n${sessionEntries}`
      }
    } catch (err) {
      console.warn('RAG retrieval failed, proceeding with profile-only mode:', err)
    }
  }

  const ragGuidelines = sources.length > 0
    ? `\n- When referencing past workouts from memory, cite the date and specific details\n- Include a 'Sources used' section at the end listing which past sessions informed your response`
    : ''

  const prompt = `You are an experienced strength and conditioning coach. You have been coaching this user for months and know their training history intimately.

${profileSection}

${workoutSection}${ragSection}

## Guidelines
- Generate workout plans as structured data when asked
- Adjust weights and volume based on the user's feedback and known maxes
- Never prescribe weight above 120% of a known max without explicit discussion
- Be encouraging but data-driven
- Reference specific past workouts when relevant
- If the user reports pain or injury, immediately modify the program to avoid aggravation
- Keep responses concise and actionable -- this is used in a mobile chat interface${ragGuidelines}`

  return { prompt, sources }
}

/**
 * Format a single workout (with exercises and sets) into readable text
 * for inclusion in the system prompt context.
 */
export function formatWorkoutForContext(workout: {
  date: string
  programName: string | null
  feedback: string | null
  exercises: Array<{
    name: string
    restSeconds: number | null
    sets: Array<{
      setNumber: number
      reps: number | null
      weight: number | null
      rpe: number | null
    }>
  }>
}): string {
  const exerciseLines = workout.exercises
    .map((ex) => {
      const setLines = ex.sets
        .map(
          (s) =>
            `  Set ${s.setNumber}: ${s.reps ?? '?'} reps @ ${s.weight ?? '?'}lbs${s.rpe ? ` RPE ${s.rpe}` : ''}`
        )
        .join('\n')
      return `- ${ex.name}${ex.restSeconds ? ` (rest: ${ex.restSeconds}s)` : ''}\n${setLines}`
    })
    .join('\n')

  return `### ${workout.date} - ${workout.programName || 'Workout'}
${workout.feedback ? `Feedback: ${workout.feedback}` : ''}
${exerciseLines}`
}

/**
 * Convert database messages (role + content) to Gemini SDK Content[] format
 * for passing as chat history.
 */
export function messagesToHistory(
  dbMessages: Array<{ role: string; content: string }>
): Array<{ role: string; parts: Array<{ text: string }> }> {
  return dbMessages.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }))
}
