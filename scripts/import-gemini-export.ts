/**
 * Parse the Gemini conversation export and generate SQL for import.
 *
 * Usage: npx tsx scripts/import-gemini-export.ts > /tmp/import.sql
 *   Then: docker exec -i workout-supabase-db psql -U postgres -d postgres < /tmp/import.sql
 */
import { readFileSync } from 'fs'

const USER_ID = '5f84921c-b819-4a5e-aa53-5c344da85ab6'
const EXPORT_PATH = './workout_memory.md'

// ---- Helpers ----

function esc(s: string): string {
  return s.replace(/'/g, "''")
}

// ---- Parse messages ----

interface Message {
  role: 'user' | 'model'
  content: string
  turnNumber: number
}

function parseMessages(text: string): Message[] {
  const messages: Message[] = []
  const sections = text.split(/\n---\n/)

  let turnNumber = 0
  for (const section of sections) {
    const trimmed = section.trim()

    const userMatch = trimmed.match(/^## User \(Turn (\d+)\)\s*\n+([\s\S]*)/)
    if (userMatch) {
      turnNumber = parseInt(userMatch[1])
      messages.push({
        role: 'user',
        content: userMatch[2].trim().slice(0, 10000),
        turnNumber,
      })
      continue
    }

    if (trimmed.startsWith('## Gemini')) {
      const content = trimmed.replace(/^## Gemini\s*\n+/, '').trim()
      if (content) {
        messages.push({
          role: 'model',
          content: content.slice(0, 10000),
          turnNumber,
        })
      }
      continue
    }
  }

  return messages
}

// ---- Workout data (manually extracted from conversation) ----

interface WorkoutData {
  date: string
  programName: string
  turn: number
  exercises: Array<{
    name: string
    sets: Array<{ reps: number; weight: number | null; notes?: string }>
  }>
}

const workouts: WorkoutData[] = [
  // Workout A #1 - Turn 23-27
  {
    date: '2026-01-13',
    programName: 'Workout A - Phase 1 (Week 1)',
    turn: 23,
    exercises: [
      { name: 'Barbell Floor Press', sets: [{ reps: 8, weight: 135 }, { reps: 8, weight: 135 }, { reps: 8, weight: 135 }, { reps: 8, weight: 135 }] },
      { name: 'Inverted Barbell Row', sets: [{ reps: 10, weight: null }, { reps: 10, weight: null }, { reps: 6, weight: null }, { reps: 5, weight: null }] },
      { name: 'Decline Pushups', sets: [{ reps: 10, weight: null }, { reps: 9, weight: null }, { reps: 8, weight: null }] },
      { name: 'Pull-up Negatives', sets: [{ reps: 5, weight: null, notes: '5sec descent' }, { reps: 5, weight: null, notes: '5sec descent' }, { reps: 5, weight: null, notes: '5sec descent' }] },
    ],
  },
  // Workout B #1 - Turn 38
  {
    date: '2026-01-15',
    programName: 'Workout B - Phase 1 (Week 1)',
    turn: 38,
    exercises: [
      { name: 'Barbell Glute Bridge', sets: [{ reps: 12, weight: 95 }, { reps: 12, weight: 95 }, { reps: 12, weight: 95 }, { reps: 12, weight: 95 }] },
      { name: 'Step-ups', sets: [{ reps: 10, weight: null }, { reps: 10, weight: null }, { reps: 10, weight: null }] },
      { name: 'Seated Overhead Press', sets: [{ reps: 8, weight: 65, notes: 'corrected form' }, { reps: 8, weight: 45 }, { reps: 8, weight: 45 }] },
      { name: 'Dead Bugs', sets: [{ reps: 15, weight: null }, { reps: 15, weight: null }, { reps: 15, weight: null }] },
      { name: 'RKC Plank', sets: [{ reps: 1, weight: null, notes: '45sec hold' }, { reps: 1, weight: null, notes: '45sec hold' }, { reps: 1, weight: null, notes: '45sec hold' }] },
    ],
  },
  // Workout A #2 - Turn 64 (~Jan 24)
  {
    date: '2026-01-24',
    programName: 'Workout A - Phase 1 (Week 2)',
    turn: 64,
    exercises: [
      { name: 'Barbell Floor Press', sets: [{ reps: 9, weight: 135 }, { reps: 9, weight: 135 }, { reps: 9, weight: 135 }, { reps: 9, weight: 135 }] },
      { name: 'Inverted Barbell Row', sets: [{ reps: 8, weight: null }, { reps: 8, weight: null }, { reps: 8, weight: null }, { reps: 8, weight: null, notes: 'last rep no chest touch' }] },
      { name: 'Tempo Decline Pushups', sets: [{ reps: 10, weight: null, notes: '3sec descent' }, { reps: 8, weight: null, notes: '3sec descent' }, { reps: 7, weight: null, notes: '3sec descent' }] },
      { name: 'Pull-up Negatives', sets: [{ reps: 5, weight: null, notes: '7sec descent' }, { reps: 5, weight: null, notes: '7sec descent' }, { reps: 5, weight: null, notes: '7sec descent' }] },
    ],
  },
  // Workout A #3 - Turn 89 (~Feb 1, Sun)
  {
    date: '2026-02-01',
    programName: 'Workout A - Phase 1 (Week 3)',
    turn: 89,
    exercises: [
      { name: 'Barbell Floor Press', sets: [{ reps: 10, weight: 135 }, { reps: 10, weight: 135 }, { reps: 10, weight: 135 }, { reps: 10, weight: 135 }] },
      { name: 'Inverted Barbell Row', sets: [{ reps: 8, weight: null }, { reps: 8, weight: null }, { reps: 8, weight: null }, { reps: 7, weight: null, notes: '7th not quite touching' }] },
      { name: 'Tempo Pushups', sets: [{ reps: 10, weight: null }, { reps: 6, weight: null }, { reps: 6, weight: null }] },
      { name: 'Pull-up Negatives', sets: [{ reps: 5, weight: null, notes: '7sec, palms facing each other' }, { reps: 5, weight: null, notes: '7sec' }, { reps: 5, weight: null, notes: '7sec' }] },
    ],
  },
  // Workout B #2 - Turn 98 (~Feb 2)
  {
    date: '2026-02-02',
    programName: 'Workout B - Phase 1 (Week 3)',
    turn: 98,
    exercises: [
      { name: 'Barbell Glute Bridge', sets: [{ reps: 15, weight: 95 }, { reps: 15, weight: 95 }, { reps: 15, weight: 95 }, { reps: 15, weight: 95 }] },
      { name: 'Step-ups', sets: [{ reps: 10, weight: null, notes: '2sec descent' }, { reps: 10, weight: null, notes: '2sec descent' }, { reps: 10, weight: null, notes: '2sec descent' }] },
      { name: 'Seated Overhead Press', sets: [{ reps: 8, weight: 55 }, { reps: 8, weight: 55 }, { reps: 8, weight: 55 }] },
      { name: 'Dead Bugs', sets: [{ reps: 15, weight: 5, notes: '5lb weights in hands' }, { reps: 15, weight: 5 }, { reps: 15, weight: 5 }] },
      { name: 'RKC Plank', sets: [{ reps: 1, weight: null, notes: '45sec hold' }, { reps: 1, weight: null, notes: '45sec hold' }, { reps: 1, weight: null, notes: '45sec hold' }] },
    ],
  },
  // Workout A #4 - Turn 101 (Feb 4, Wed)
  {
    date: '2026-02-04',
    programName: 'Workout A - Phase 1 (Week 4)',
    turn: 101,
    exercises: [
      { name: 'Barbell Floor Press', sets: [{ reps: 8, weight: 145 }, { reps: 8, weight: 145 }, { reps: 8, weight: 145 }, { reps: 8, weight: 145 }] },
      { name: 'Inverted Barbell Row', sets: [{ reps: 8, weight: null, notes: '3sec hold first rep' }, { reps: 8, weight: null, notes: '3sec hold first rep' }, { reps: 8, weight: null, notes: '3sec hold first rep' }, { reps: 8, weight: null, notes: '3sec hold first rep' }] },
      { name: 'Tempo Pushups', sets: [{ reps: 8, weight: null }, { reps: 8, weight: null }, { reps: 8, weight: null }] },
      { name: 'Pull-up Negatives', sets: [{ reps: 5, weight: null, notes: '7sec descent' }, { reps: 5, weight: null, notes: '7sec descent' }, { reps: 5, weight: null, notes: '7sec descent' }] },
    ],
  },
  // Workout B #3 - Turn 105 (Feb 6, Fri)
  {
    date: '2026-02-06',
    programName: 'Workout B - Phase 1 (Week 4)',
    turn: 105,
    exercises: [
      { name: 'Barbell Glute Bridge', sets: [{ reps: 15, weight: 105 }, { reps: 15, weight: 105 }, { reps: 15, weight: 105 }, { reps: 15, weight: 105 }] },
      { name: 'Step-ups', sets: [{ reps: 10, weight: null, notes: '2sec descent, more stable' }, { reps: 10, weight: null }, { reps: 10, weight: null }] },
      { name: 'Seated Overhead Press', sets: [{ reps: 8, weight: 55, notes: 'shrug with each rep' }, { reps: 8, weight: 55 }, { reps: 8, weight: 55 }] },
      { name: 'Dead Bugs', sets: [{ reps: 15, weight: 5 }, { reps: 15, weight: 5 }, { reps: 15, weight: 5 }] },
      { name: 'RKC Plank', sets: [{ reps: 1, weight: null, notes: '45sec hold' }, { reps: 1, weight: null, notes: '45sec hold' }, { reps: 1, weight: null, notes: '45sec hold' }] },
    ],
  },
  // Workout A #5 - Turn 120 (Feb 9, Mon)
  {
    date: '2026-02-09',
    programName: 'Workout A - Phase 2 (Week 5)',
    turn: 120,
    exercises: [
      { name: 'Barbell Floor Press', sets: [{ reps: 10, weight: 145 }, { reps: 8, weight: 145 }, { reps: 8, weight: 145 }, { reps: 9, weight: 145 }] },
      { name: 'Inverted Barbell Row', sets: [{ reps: 8, weight: null, notes: '3sec hold first rep, elbows to wall' }, { reps: 8, weight: null }, { reps: 8, weight: null }, { reps: 8, weight: null }] },
      { name: 'Tempo Incline Pushups', sets: [{ reps: 8, weight: null, notes: '3sec descent' }, { reps: 8, weight: null }, { reps: 8, weight: null }] },
      { name: 'Pull-up Negatives', sets: [{ reps: 5, weight: null, notes: '10sec descent' }, { reps: 5, weight: null, notes: '10sec descent' }, { reps: 5, weight: null, notes: '10sec descent' }] },
    ],
  },
  // Workout B #4 - Turn 132 (Feb 11, Wed)
  {
    date: '2026-02-11',
    programName: 'Workout B - Phase 2 (Week 5)',
    turn: 132,
    exercises: [
      { name: 'Barbell Glute Bridge', sets: [{ reps: 15, weight: 115, notes: '2sec hold' }, { reps: 15, weight: 115 }, { reps: 15, weight: 115 }, { reps: 15, weight: 115 }] },
      { name: 'Step-ups', sets: [{ reps: 10, weight: null, notes: '3sec descent, shaky' }, { reps: 10, weight: null }, { reps: 10, weight: null }] },
      { name: 'Seated Overhead Press', sets: [{ reps: 9, weight: 55 }, { reps: 9, weight: 55 }, { reps: 10, weight: 55 }] },
      { name: 'Lateral Raises', sets: [{ reps: 15, weight: 5 }, { reps: 15, weight: 5 }, { reps: 15, weight: 5 }] },
      { name: 'Dead Bugs', sets: [{ reps: 15, weight: 5 }, { reps: 15, weight: 5 }, { reps: 15, weight: 5 }] },
      { name: 'RKC Plank', sets: [{ reps: 1, weight: null, notes: '45sec, PPT + glute squeeze' }, { reps: 1, weight: null, notes: '45sec' }, { reps: 1, weight: null, notes: '45sec' }] },
    ],
  },
  // Workout A #6 - Turn 143 (Feb 13, Fri)
  {
    date: '2026-02-13',
    programName: 'Workout A - Phase 2 (Week 5)',
    turn: 143,
    exercises: [
      { name: 'Barbell Floor Press', sets: [{ reps: 10, weight: 145 }, { reps: 10, weight: 145 }, { reps: 8, weight: 145 }, { reps: 8, weight: 145 }] },
      { name: 'Inverted Barbell Row', sets: [{ reps: 9, weight: null, notes: '3sec hold first rep' }, { reps: 9, weight: null }, { reps: 9, weight: null }, { reps: 9, weight: null }] },
      { name: 'Decline Pushups', sets: [{ reps: 9, weight: null }, { reps: 9, weight: null }, { reps: 9, weight: null }] },
      { name: 'Pull-up Negatives', sets: [{ reps: 5, weight: null, notes: '10sec descent, palms facing' }, { reps: 5, weight: null, notes: '10sec descent' }, { reps: 5, weight: null, notes: '10sec descent' }] },
    ],
  },
  // Workout B #5 - Turn 164 (Feb 16, Mon)
  {
    date: '2026-02-16',
    programName: 'Workout B - Phase 2 (Week 6)',
    turn: 164,
    exercises: [
      { name: 'Barbell Glute Bridge', sets: [{ reps: 15, weight: 115, notes: 'better glute targeting' }, { reps: 15, weight: 115 }, { reps: 15, weight: 115 }, { reps: 15, weight: 115 }] },
      { name: 'Step-ups', sets: [{ reps: 10, weight: null, notes: '3sec descent, still shaky' }, { reps: 10, weight: null }, { reps: 10, weight: null }] },
      { name: 'Seated Overhead Press', sets: [{ reps: 10, weight: 55 }, { reps: 10, weight: 55 }, { reps: 10, weight: 55 }] },
      { name: 'Lateral Raises', sets: [{ reps: 15, weight: 5 }, { reps: 20, weight: 5 }, { reps: 20, weight: 5 }] },
      { name: 'Dead Bugs', sets: [{ reps: 15, weight: 5 }, { reps: 15, weight: 5 }, { reps: 15, weight: 5 }] },
      { name: 'RKC Plank', sets: [{ reps: 1, weight: null, notes: '45sec, glute squeeze' }, { reps: 1, weight: null, notes: '45sec' }, { reps: 1, weight: null, notes: '45sec' }] },
    ],
  },
  // Workout A #7 - Turn 173 (Feb 18, Wed)
  {
    date: '2026-02-18',
    programName: 'Workout A - Phase 2 (Week 6)',
    turn: 173,
    exercises: [
      { name: 'Barbell Floor Press', sets: [{ reps: 10, weight: 145 }, { reps: 10, weight: 145 }, { reps: 8, weight: 145 }, { reps: 8, weight: 145 }] },
      { name: 'Inverted Barbell Row', sets: [{ reps: 10, weight: null, notes: '1sec hold' }, { reps: 8, weight: null, notes: '1sec hold + 2 no hold' }, { reps: 4, weight: null, notes: '1sec hold + 6 no hold' }, { reps: 10, weight: null, notes: 'no hold' }] },
      { name: 'Tempo Pushups', sets: [{ reps: 10, weight: null }, { reps: 8, weight: null }, { reps: 8, weight: null }] },
      { name: 'Pull-up Negatives', sets: [{ reps: 5, weight: null, notes: '10sec descent' }, { reps: 5, weight: null, notes: '10sec descent' }, { reps: 5, weight: null, notes: '10sec descent' }] },
    ],
  },
  // Workout B #6 - Turn 176 (Feb 20, Fri)
  {
    date: '2026-02-20',
    programName: 'Workout B - Phase 2 (Week 6)',
    turn: 176,
    exercises: [
      { name: 'Barbell Glute Bridge', sets: [{ reps: 15, weight: 125 }, { reps: 15, weight: 125 }, { reps: 15, weight: 125 }, { reps: 15, weight: 125 }] },
      { name: 'Step-ups', sets: [{ reps: 10, weight: null, notes: 'less shaky' }, { reps: 10, weight: null }, { reps: 10, weight: null }] },
      { name: 'Seated Overhead Press', sets: [{ reps: 8, weight: 60 }, { reps: 8, weight: 60 }, { reps: 8, weight: 60 }] },
      { name: 'Lateral Raises', sets: [{ reps: 20, weight: 5 }, { reps: 20, weight: 5 }, { reps: 20, weight: 5 }] },
      { name: 'Dead Bugs', sets: [{ reps: 15, weight: 5, notes: 'back snug on ground' }, { reps: 15, weight: 5 }, { reps: 15, weight: 5 }] },
      { name: 'RKC Plank', sets: [{ reps: 1, weight: null, notes: '45sec, core higher, glutes tight' }, { reps: 1, weight: null, notes: '45sec' }, { reps: 1, weight: null, notes: '45sec' }] },
    ],
  },
]

// ---- Generate SQL ----

function main() {
  const text = readFileSync(EXPORT_PATH, 'utf-8')
  const msgs = parseMessages(text)

  const lines: string[] = []
  lines.push('BEGIN;')
  lines.push('')

  // 1. Coaching profile
  lines.push('-- Coaching Profile')
  const biometrics = JSON.stringify({ height: "6'6\"", weight: 209, age: 42, bodyType: "hard-gainer" })
  const maxes = JSON.stringify({ "floor press": 145, "overhead press": 60, "barbell row": null, "glute bridge": 125 })
  const injuries = JSON.stringify(["moderate anterior pelvic tilt", "occasional lower back pain (1-3/10)", "avoid deadlifts and bench press per user preference"])
  const equipment = JSON.stringify(["4-post rack (93 inches tall)", "multigrip pull-up bar", "barbell with J-cups", "plates: 2x45, 2x25, 2x15, 2x10, 2x5 (245 lbs total with bar)", "dip station", "adjustable bench", "push-up grips", "35 lb weighted backpack"])
  const preferences = JSON.stringify({
    daysPerWeek: 4,
    schedule: "Workout A (upper) and Workout B (lower/posture) alternating, with active recovery days",
    goals: ["muscle growth and definition (chest primary, back secondary, legs tertiary)", "correction of anterior pelvic tilt", "reduction of visceral belly fat"],
    excludedExercises: ["deadlifts", "bench press", "exercises that risk back injury"],
    safeAlternatives: ["floor press", "weighted dips", "step-ups", "split squats"],
    trainingStyle: "Heavy, Low-Volume, High-Density for hard-gainer",
  })

  lines.push(`INSERT INTO coaching_profiles (user_id, biometrics, maxes, injuries, equipment, dietary_constraints, preferences, updated_at)`)
  lines.push(`VALUES ('${USER_ID}', '${esc(biometrics)}', '${esc(maxes)}', '${esc(injuries)}', '${esc(equipment)}', '[]', '${esc(preferences)}', NOW())`)
  lines.push(`ON CONFLICT (user_id) DO UPDATE SET biometrics = EXCLUDED.biometrics, maxes = EXCLUDED.maxes, injuries = EXCLUDED.injuries, equipment = EXCLUDED.equipment, preferences = EXCLUDED.preferences, updated_at = EXCLUDED.updated_at;`)
  lines.push('')

  // 2. Nutrition goals
  lines.push('-- Nutrition Goals')
  lines.push(`INSERT INTO nutrition_goals (user_id, calories_target, protein_target, carbs_target, fat_target, fiber_target, updated_at)`)
  lines.push(`VALUES ('${USER_ID}', 3200, 205, 350, 90, 35, NOW())`)
  lines.push(`ON CONFLICT (user_id) DO UPDATE SET calories_target = EXCLUDED.calories_target, protein_target = EXCLUDED.protein_target, carbs_target = EXCLUDED.carbs_target, fat_target = EXCLUDED.fat_target, fiber_target = EXCLUDED.fiber_target, updated_at = EXCLUDED.updated_at;`)
  lines.push('')

  // 3. Messages (all 358)
  lines.push('-- Messages')
  const baseTime = new Date('2026-01-09T21:28:00Z')
  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i]
    const ts = new Date(baseTime.getTime() + i * 120000) // 2 min apart
    lines.push(`INSERT INTO messages (user_id, role, content, created_at) VALUES ('${USER_ID}', '${msg.role}', '${esc(msg.content)}', '${ts.toISOString()}');`)
  }
  lines.push('')

  // 4. Workouts with exercises and sets
  lines.push('-- Workouts')
  for (const w of workouts) {
    lines.push(`DO $$ DECLARE w_id INTEGER; e_id INTEGER; BEGIN`)
    lines.push(`  INSERT INTO workouts (user_id, date, program_name, created_at) VALUES ('${USER_ID}', '${w.date}', '${esc(w.programName)}', '${w.date}T08:00:00Z') RETURNING id INTO w_id;`)

    for (let ei = 0; ei < w.exercises.length; ei++) {
      const ex = w.exercises[ei]
      lines.push(`  INSERT INTO exercises (user_id, workout_id, name, "order") VALUES ('${USER_ID}', w_id, '${esc(ex.name)}', ${ei + 1}) RETURNING id INTO e_id;`)

      for (let si = 0; si < ex.sets.length; si++) {
        const s = ex.sets[si]
        const weightVal = s.weight !== null ? `${s.weight}` : 'NULL'
        const notesVal = s.notes ? `'${esc(s.notes)}'` : 'NULL'
        lines.push(`  INSERT INTO sets (user_id, exercise_id, set_number, reps, weight, actual_reps, actual_weight, notes) VALUES ('${USER_ID}', e_id, ${si + 1}, ${s.reps}, ${weightVal}, ${s.reps}, ${weightVal}, ${notesVal});`)
      }
    }

    lines.push(`END $$;`)
    lines.push('')
  }

  lines.push('COMMIT;')
  lines.push('')

  // Summary queries
  lines.push('-- Summary')
  lines.push(`SELECT 'messages' AS table_name, COUNT(*) AS count FROM messages WHERE user_id = '${USER_ID}';`)
  lines.push(`SELECT 'workouts' AS table_name, COUNT(*) AS count FROM workouts WHERE user_id = '${USER_ID}';`)
  lines.push(`SELECT 'exercises' AS table_name, COUNT(*) AS count FROM exercises WHERE user_id = '${USER_ID}';`)
  lines.push(`SELECT 'sets' AS table_name, COUNT(*) AS count FROM sets WHERE user_id = '${USER_ID}';`)
  lines.push(`SELECT 'coaching_profiles' AS table_name, COUNT(*) AS count FROM coaching_profiles WHERE user_id = '${USER_ID}';`)
  lines.push(`SELECT 'nutrition_goals' AS table_name, COUNT(*) AS count FROM nutrition_goals WHERE user_id = '${USER_ID}';`)

  process.stdout.write(lines.join('\n'))
}

main()
