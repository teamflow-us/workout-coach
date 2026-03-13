/**
 * Sync messages and workout data from workout_memory.md to the remote database.
 * Inserts turns 180-232 messages and workout sessions from Feb 23 - Mar 12.
 *
 * Usage: npx tsx scripts/sync-remote-data.ts
 */
import 'dotenv/config'
import { readFileSync } from 'fs'
import postgres from 'postgres'

const USER_ID = '5f84921c-b819-4a5e-aa53-5c344da85ab6'
const EXPORT_PATH = './workout_memory.md'

interface Turn {
  role: 'user' | 'model'
  content: string
  turnNumber: number
}

function parseConversation(text: string): Turn[] {
  const turns: Turn[] = []
  const sections = text.split(/\n---\n/)
  let turnNumber = 0

  for (const section of sections) {
    const trimmed = section.trim()
    const userMatch = trimmed.match(/^## User \(Turn (\d+)\)\s*\n+([\s\S]*)/)
    if (userMatch) {
      turnNumber = parseInt(userMatch[1])
      turns.push({ role: 'user', content: userMatch[2].trim(), turnNumber })
      continue
    }
    if (trimmed.startsWith('## Gemini')) {
      const content = trimmed.replace(/^## Gemini\s*\n+/, '').trim()
      if (content) {
        turns.push({ role: 'model', content, turnNumber })
      }
    }
  }
  return turns
}

// Estimate date from turn number (conversation started Jan 9, 2026)
function estimateDate(turnNumber: number): string {
  const start = new Date('2026-01-09')
  const daysOffset = Math.floor(turnNumber / 3)
  const d = new Date(start.getTime() + daysOffset * 86400000)
  return d.toISOString().split('T')[0]
}

async function main() {
  const sqlClient = postgres(process.env.DATABASE_URL!)
  const text = readFileSync(EXPORT_PATH, 'utf-8')
  const turns = parseConversation(text)

  // Filter to only new turns (180+)
  const newTurns = turns.filter(t => t.turnNumber >= 180)
  console.log(`Found ${newTurns.length} turns >= 180`)

  // Check existing message count
  const existing = await sqlClient`SELECT COUNT(*) as cnt FROM messages WHERE user_id = ${USER_ID}`
  console.log(`Existing messages: ${existing[0].cnt}`)

  // Insert messages for new turns
  let inserted = 0
  for (const turn of newTurns) {
    const date = estimateDate(turn.turnNumber)
    const createdAt = `${date}T08:00:00.000Z`

    // Check if this message already exists (by content prefix + role)
    const preview = turn.content.slice(0, 100)
    const check = await sqlClient`
      SELECT id FROM messages
      WHERE user_id = ${USER_ID}
        AND role = ${turn.role}
        AND substring(content, 1, 100) = ${preview}
      LIMIT 1
    `
    if (check.length > 0) {
      continue
    }

    await sqlClient`
      INSERT INTO messages (user_id, role, content, created_at)
      VALUES (${USER_ID}, ${turn.role}, ${turn.content}, ${createdAt})
    `
    inserted++
  }
  console.log(`Inserted ${inserted} new messages`)

  // --- Insert workout data ---
  console.log('\nInserting workout sessions...')

  const workoutData = [
    {
      date: '2026-02-23',
      programName: 'Workout A - Phase 2 (Week 7)',
      notes: 'Volume PR attempt on Floor Press. Modified inverted row form.',
      exercises: [
        {
          name: 'Barbell Floor Press', order: 1, restSeconds: 120,
          sets: [
            { setNumber: 1, reps: 10, weight: 145 },
            { setNumber: 2, reps: 10, weight: 145 },
            { setNumber: 3, reps: 10, weight: 145 },
            { setNumber: 4, reps: 9, weight: 145, actualReps: 9 },
          ]
        },
        {
          name: 'Inverted Rows', order: 2, restSeconds: 90,
          sets: [
            { setNumber: 1, reps: 10, weight: 0, notes: '1-sec hold' },
            { setNumber: 2, reps: 10, weight: 0, notes: '1-sec hold' },
            { setNumber: 3, reps: 8, weight: 0, notes: '1-sec hold' },
            { setNumber: 4, reps: 2, weight: 0, notes: 'no hold' },
            { setNumber: 5, reps: 10, weight: 0, notes: 'no hold' },
          ]
        },
        {
          name: 'Tempo Pushups (Decline)', order: 3, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 10, weight: 0 },
            { setNumber: 2, reps: 6, weight: 0 },
            { setNumber: 3, reps: 4, weight: 0 },
          ]
        },
        {
          name: 'Tempo Pushups (Floor)', order: 4, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 2, weight: 0 },
            { setNumber: 2, reps: 1, weight: 0 },
          ]
        },
        {
          name: 'Tempo Pushups (Knee)', order: 5, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 2, weight: 0 },
            { setNumber: 2, reps: 5, weight: 0 },
          ]
        },
        {
          name: 'Pull-up Negatives', order: 6, restSeconds: 90,
          sets: [
            { setNumber: 1, reps: 5, weight: 0, notes: '10-sec descent' },
            { setNumber: 2, reps: 5, weight: 0, notes: '10-sec descent' },
            { setNumber: 3, reps: 5, weight: 0, notes: '10-sec descent' },
          ]
        },
      ]
    },
    {
      date: '2026-02-25',
      programName: 'Workout B - Phase 2 (Week 7)',
      notes: 'Glute bridge weight PR. OHP near target.',
      exercises: [
        {
          name: 'Barbell Glute Bridges', order: 1, restSeconds: 90,
          sets: [
            { setNumber: 1, reps: 15, weight: 135 },
            { setNumber: 2, reps: 15, weight: 135 },
            { setNumber: 3, reps: 15, weight: 135 },
            { setNumber: 4, reps: 15, weight: 135 },
          ]
        },
        {
          name: 'Step-ups', order: 2, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 10, weight: 0, notes: '3-sec descent' },
            { setNumber: 2, reps: 10, weight: 0, notes: '3-sec descent' },
            { setNumber: 3, reps: 10, weight: 0, notes: '3-sec descent' },
          ]
        },
        {
          name: 'Overhead Press', order: 3, restSeconds: 90,
          sets: [
            { setNumber: 1, reps: 9, weight: 60 },
            { setNumber: 2, reps: 9, weight: 60 },
            { setNumber: 3, reps: 9, weight: 60 },
          ]
        },
        {
          name: 'Lateral Raises', order: 4, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 15, weight: 8 },
            { setNumber: 2, reps: 15, weight: 8 },
            { setNumber: 3, reps: 15, weight: 8 },
          ]
        },
        {
          name: 'Weighted Deadbugs', order: 5, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 15, weight: 8 },
            { setNumber: 2, reps: 15, weight: 8 },
            { setNumber: 3, reps: 15, weight: 8 },
          ]
        },
        {
          name: 'RKC Plank', order: 6, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 1, weight: 0, notes: '45-sec hold' },
            { setNumber: 2, reps: 1, weight: 0, notes: '45-sec hold' },
            { setNumber: 3, reps: 1, weight: 0, notes: '45-sec hold' },
          ]
        },
      ]
    },
    {
      date: '2026-02-27',
      programName: 'Workout A - Phase 2 (Week 8)',
      notes: 'Form reset on inverted rows. New band exercises added.',
      exercises: [
        {
          name: 'Scapular Shrugs', order: 1, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 12, weight: 0, notes: 'Red band' },
            { setNumber: 2, reps: 12, weight: 0, notes: 'Red band' },
          ]
        },
        {
          name: 'Face Pulls', order: 2, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 20, weight: 0, notes: '15/35 band' },
            { setNumber: 2, reps: 20, weight: 0, notes: '15/35 band' },
            { setNumber: 3, reps: 20, weight: 0, notes: '15/35 band' },
          ]
        },
        {
          name: 'Barbell Floor Press', order: 3, restSeconds: 120,
          sets: [
            { setNumber: 1, reps: 10, weight: 145 },
            { setNumber: 2, reps: 10, weight: 145 },
            { setNumber: 3, reps: 10, weight: 145 },
            { setNumber: 4, reps: 9, weight: 145, actualReps: 9 },
          ]
        },
        {
          name: 'Inverted Rows', order: 4, restSeconds: 90,
          sets: [
            { setNumber: 1, reps: 7, weight: 0, notes: 'Corrected form, 1-sec hold' },
            { setNumber: 2, reps: 5, weight: 0, notes: '1-sec hold' },
            { setNumber: 3, reps: 5, weight: 0, notes: '1-sec hold' },
            { setNumber: 4, reps: 5, weight: 0, notes: '1-sec hold' },
          ]
        },
        {
          name: 'Standing Band Flys', order: 5, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 15, weight: 0, notes: '15/35 band' },
            { setNumber: 2, reps: 15, weight: 0, notes: '15/35 band' },
            { setNumber: 3, reps: 15, weight: 0, notes: '15/35 band' },
          ]
        },
        {
          name: 'Pull-up Negatives', order: 6, restSeconds: 90,
          sets: [
            { setNumber: 1, reps: 5, weight: 0, notes: '11-sec descent' },
            { setNumber: 2, reps: 5, weight: 0, notes: '11-sec descent' },
            { setNumber: 3, reps: 5, weight: 0, notes: '11-sec descent' },
          ]
        },
        {
          name: 'Weighted Deadbugs', order: 7, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 15, weight: 10 },
            { setNumber: 2, reps: 15, weight: 10 },
            { setNumber: 3, reps: 15, weight: 10 },
          ]
        },
        {
          name: 'RKC Plank', order: 8, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 1, weight: 0, notes: '60-sec hold' },
            { setNumber: 2, reps: 1, weight: 0, notes: '60-sec hold' },
            { setNumber: 3, reps: 1, weight: 0, notes: '60-sec hold' },
          ]
        },
        {
          name: 'Single-Arm High Pulls', order: 9, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 20, weight: 0, notes: '15/35 band' },
            { setNumber: 2, reps: 20, weight: 0, notes: '15/35 band' },
          ]
        },
      ]
    },
    {
      date: '2026-03-04',
      programName: 'Workout A - Phase 3 (Week 9)',
      notes: 'Row form improving. Pull-up negatives 13-sec PR.',
      exercises: [
        {
          name: 'Scapular Shrugs', order: 1, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 12, weight: 0, notes: 'Red band' },
            { setNumber: 2, reps: 12, weight: 0, notes: 'Red band' },
          ]
        },
        {
          name: 'Face Pulls', order: 2, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 20, weight: 0, notes: 'Red band' },
            { setNumber: 2, reps: 20, weight: 0, notes: 'Red band' },
            { setNumber: 3, reps: 20, weight: 0, notes: 'Red band' },
          ]
        },
        {
          name: 'Barbell Floor Press', order: 3, restSeconds: 120,
          sets: [
            { setNumber: 1, reps: 10, weight: 145 },
            { setNumber: 2, reps: 10, weight: 145 },
            { setNumber: 3, reps: 10, weight: 145 },
            { setNumber: 4, reps: 9, weight: 145, actualReps: 9 },
          ]
        },
        {
          name: 'Inverted Rows', order: 4, restSeconds: 90,
          sets: [
            { setNumber: 1, reps: 8, weight: 0, notes: '1-sec hold, strict form' },
            { setNumber: 2, reps: 7, weight: 0, notes: '1-sec hold' },
            { setNumber: 3, reps: 7, weight: 0, notes: '1-sec hold' },
            { setNumber: 4, reps: 7, weight: 0, notes: '1-sec hold' },
          ]
        },
        {
          name: 'Standing Band Flys', order: 5, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 15, weight: 0, notes: 'Purple band, 2-sec squeeze' },
            { setNumber: 2, reps: 15, weight: 0, notes: 'Purple band, 2-sec squeeze' },
            { setNumber: 3, reps: 15, weight: 0, notes: 'Purple band, 2-sec squeeze' },
          ]
        },
        {
          name: 'Pull-up Negatives', order: 6, restSeconds: 90,
          sets: [
            { setNumber: 1, reps: 5, weight: 0, notes: '13-sec descent' },
            { setNumber: 2, reps: 5, weight: 0, notes: '13-sec descent' },
            { setNumber: 3, reps: 5, weight: 0, notes: '11-sec descent' },
          ]
        },
        {
          name: 'Single-Arm High Pulls', order: 7, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 20, weight: 0, notes: 'Black band' },
            { setNumber: 2, reps: 20, weight: 0, notes: 'Black band' },
          ]
        },
        {
          name: 'Weighted Deadbugs', order: 8, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 15, weight: 10 },
            { setNumber: 2, reps: 15, weight: 10 },
            { setNumber: 3, reps: 15, weight: 10 },
          ]
        },
        {
          name: 'RKC Plank', order: 9, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 1, weight: 0, notes: '60-sec hold' },
            { setNumber: 2, reps: 1, weight: 0, notes: '60-sec hold' },
            { setNumber: 3, reps: 1, weight: 0, notes: '60-sec hold' },
          ]
        },
      ]
    },
    {
      date: '2026-03-06',
      programName: 'Workout B - Travel (Week 9)',
      notes: 'Travel workout with bands only. Frog pump variation.',
      exercises: [
        {
          name: 'Scapular Shrugs', order: 1, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 12, weight: 0, notes: 'Red band' },
            { setNumber: 2, reps: 12, weight: 0, notes: 'Red band' },
          ]
        },
        {
          name: 'Face Pulls', order: 2, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 20, weight: 0, notes: 'Red band' },
            { setNumber: 2, reps: 20, weight: 0, notes: 'Red band' },
            { setNumber: 3, reps: 20, weight: 0, notes: 'Red band' },
          ]
        },
        {
          name: 'Banded Glute Bridges', order: 3, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 20, weight: 0, notes: 'Green band' },
          ]
        },
        {
          name: 'Frog Pumps', order: 4, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 20, weight: 0, notes: 'Purple band double-wrapped' },
            { setNumber: 2, reps: 20, weight: 0, notes: 'Purple band double-wrapped' },
            { setNumber: 3, reps: 20, weight: 0, notes: 'Purple band double-wrapped' },
          ]
        },
        {
          name: 'Banded Overhead Press', order: 5, restSeconds: 90,
          sets: [
            { setNumber: 1, reps: 10, weight: 0, notes: 'Black band' },
            { setNumber: 2, reps: 10, weight: 0, notes: 'Black band' },
            { setNumber: 3, reps: 10, weight: 0, notes: 'Black band' },
          ]
        },
        {
          name: 'Step-ups', order: 6, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 10, weight: 0, notes: '3-sec descent, stairs' },
            { setNumber: 2, reps: 10, weight: 0, notes: '3-sec descent, stairs' },
            { setNumber: 3, reps: 10, weight: 0, notes: '3-sec descent, stairs' },
          ]
        },
        {
          name: 'Weighted Deadbugs', order: 7, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 15, weight: 5.5, notes: 'Mini coke packs' },
            { setNumber: 2, reps: 15, weight: 5.5, notes: 'Mini coke packs' },
            { setNumber: 3, reps: 15, weight: 5.5, notes: 'Mini coke packs' },
          ]
        },
        {
          name: 'RKC Plank', order: 8, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 1, weight: 0, notes: '60-sec hold' },
            { setNumber: 2, reps: 1, weight: 0, notes: '60-sec hold' },
            { setNumber: 3, reps: 1, weight: 0, notes: '60-sec hold' },
          ]
        },
      ]
    },
    {
      date: '2026-03-12',
      programName: 'Workout A - Phase 3 (Week 10)',
      notes: 'Post-travel session. Floor press lower due to CNS fatigue. Rows progressing.',
      exercises: [
        {
          name: 'Scapular Shrugs', order: 1, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 12, weight: 0, notes: 'Red band' },
            { setNumber: 2, reps: 12, weight: 0, notes: 'Red band' },
          ]
        },
        {
          name: 'Face Pulls', order: 2, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 20, weight: 0, notes: 'Red band' },
            { setNumber: 2, reps: 20, weight: 0, notes: 'Red band' },
            { setNumber: 3, reps: 20, weight: 0, notes: 'Red band' },
          ]
        },
        {
          name: 'Barbell Floor Press', order: 3, restSeconds: 120,
          sets: [
            { setNumber: 1, reps: 10, weight: 145 },
            { setNumber: 2, reps: 10, weight: 145 },
            { setNumber: 3, reps: 8, weight: 145, actualReps: 8 },
            { setNumber: 4, reps: 6, weight: 145, actualReps: 6 },
          ]
        },
        {
          name: 'Inverted Rows', order: 4, restSeconds: 90,
          sets: [
            { setNumber: 1, reps: 8, weight: 0, notes: '1-sec hold, strict form' },
            { setNumber: 2, reps: 8, weight: 0, notes: '1-sec hold' },
            { setNumber: 3, reps: 7, weight: 0, notes: '1-sec hold' },
            { setNumber: 4, reps: 6, weight: 0, notes: '1-sec hold' },
          ]
        },
        {
          name: 'Standing Band Flys', order: 5, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 15, weight: 0, notes: 'Purple band' },
            { setNumber: 2, reps: 15, weight: 0, notes: 'Purple band' },
            { setNumber: 3, reps: 15, weight: 0, notes: 'Purple band' },
          ]
        },
        {
          name: 'Pull-up Negatives', order: 6, restSeconds: 90,
          sets: [
            { setNumber: 1, reps: 5, weight: 0, notes: '11-sec descent' },
            { setNumber: 2, reps: 5, weight: 0, notes: '11-sec descent' },
            { setNumber: 3, reps: 5, weight: 0, notes: '11-sec descent' },
          ]
        },
        {
          name: 'Single-Arm High Pulls', order: 7, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 20, weight: 0, notes: 'Black band' },
            { setNumber: 2, reps: 20, weight: 0, notes: 'Black band' },
          ]
        },
        {
          name: 'Weighted Deadbugs', order: 8, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 15, weight: 10 },
            { setNumber: 2, reps: 15, weight: 10 },
            { setNumber: 3, reps: 15, weight: 10 },
          ]
        },
        {
          name: 'RKC Plank', order: 9, restSeconds: 60,
          sets: [
            { setNumber: 1, reps: 1, weight: 0, notes: '60-sec hold' },
            { setNumber: 2, reps: 1, weight: 0, notes: '60-sec hold' },
            { setNumber: 3, reps: 1, weight: 0, notes: '60-sec hold' },
          ]
        },
      ]
    },
  ]

  // Note: We only have 6 workouts here because March 2 was a rest day (no workout logged)
  // and the travel workout on March 11 was skipped

  for (const workout of workoutData) {
    // Check if workout already exists
    const check = await sqlClient`
      SELECT id FROM workouts
      WHERE user_id = ${USER_ID} AND date = ${workout.date}
      LIMIT 1
    `
    if (check.length > 0) {
      console.log(`  Workout ${workout.date} already exists (id=${check[0].id}), skipping`)
      continue
    }

    // Insert workout
    const [w] = await sqlClient`
      INSERT INTO workouts (user_id, date, program_name, notes)
      VALUES (${USER_ID}, ${workout.date}, ${workout.programName}, ${workout.notes})
      RETURNING id
    `
    const workoutId = w.id
    console.log(`  Inserted workout ${workout.date} (id=${workoutId})`)

    for (const exercise of workout.exercises) {
      const [e] = await sqlClient`
        INSERT INTO exercises (user_id, workout_id, name, "order", rest_seconds)
        VALUES (${USER_ID}, ${workoutId}, ${exercise.name}, ${exercise.order}, ${exercise.restSeconds})
        RETURNING id
      `
      const exerciseId = e.id

      for (const set of exercise.sets) {
        await sqlClient`
          INSERT INTO sets (user_id, exercise_id, set_number, reps, weight, notes, actual_reps, actual_weight)
          VALUES (
            ${USER_ID},
            ${exerciseId},
            ${set.setNumber},
            ${set.reps},
            ${set.weight},
            ${(set as any).notes || null},
            ${(set as any).actualReps || null},
            ${(set as any).actualWeight || null}
          )
        `
      }
    }
  }

  // Update coaching profile
  console.log('\nUpdating coaching profile...')
  const profileCheck = await sqlClient`
    SELECT id FROM coaching_profiles WHERE user_id = ${USER_ID}
  `

  const biometrics = JSON.stringify({
    height: "6'6\"",
    weight: 213,
    age: 42,
    bodyType: "hard-gainer",
    morningWeight: 210,
    postWorkoutWeight: 213,
  })

  const maxes = JSON.stringify({
    "floor press": 145,
    "overhead press": 60,
    "glute bridge": 135,
    "lateral raise": 8,
    "deadbug": 10,
    "pull-up negative": "13-sec descent",
  })

  const equipment = JSON.stringify([
    "barbell", "dumbbells", "squat rack", "pull-up bar",
    "REP bands (XX-Light Red 5-35, X-Light Black 20-60, Light Purple 30-80, Medium Green 40-110, Heavy Blue 60-150)",
    "Bear FitKit bands (15/35, 35/85, 50/125)",
    "REP barbell pad",
  ])

  const preferences = JSON.stringify({
    daysPerWeek: 3,
    sessionMinutes: 75,
    goals: [
      "APT correction",
      "Chest growth and definition",
      "V-taper (back/shoulder width)",
      "Visceral fat reduction",
      "Leg balance maintenance",
    ],
    targetWeight: 245,
    currentPhase: "Phase 3 - V-Taper & Definition",
  })

  if (profileCheck.length > 0) {
    await sqlClient`
      UPDATE coaching_profiles
      SET biometrics = ${biometrics},
          maxes = ${maxes},
          equipment = ${equipment},
          preferences = ${preferences},
          updated_at = NOW()
      WHERE user_id = ${USER_ID}
    `
    console.log('  Updated existing coaching profile')
  } else {
    await sqlClient`
      INSERT INTO coaching_profiles (user_id, biometrics, maxes, equipment, preferences)
      VALUES (${USER_ID}, ${biometrics}, ${maxes}, ${equipment}, ${preferences})
    `
    console.log('  Created coaching profile')
  }

  // Final counts
  const counts = await sqlClient`
    SELECT
      (SELECT COUNT(*) FROM messages WHERE user_id = ${USER_ID}) as messages,
      (SELECT COUNT(*) FROM workouts WHERE user_id = ${USER_ID}) as workouts,
      (SELECT COUNT(*) FROM exercises WHERE user_id = ${USER_ID}) as exercises,
      (SELECT COUNT(*) FROM sets WHERE user_id = ${USER_ID}) as sets,
      (SELECT COUNT(*) FROM coaching_embeddings WHERE user_id = ${USER_ID}) as embeddings
  `
  console.log('\nFinal remote DB counts:', counts[0])

  await sqlClient.end()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
