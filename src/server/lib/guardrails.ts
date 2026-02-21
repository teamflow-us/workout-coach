/**
 * Weight guardrail validation for AI-generated workouts.
 * Compares generated weights against known user maxes to flag
 * unreasonable values (hallucinated weights).
 */

export interface KnownMaxes {
  [exercise: string]: number // exercise name -> max weight in lbs
}

export interface WeightIssue {
  exercise: string
  weight: number
  max: number
  issue: string
}

// Exercise category mapping for fuzzy matching against known maxes
const EXERCISE_CATEGORIES: Record<string, string[]> = {
  bench: [
    'bench press',
    'incline bench',
    'decline bench',
    'dumbbell bench',
    'barbell bench',
    'flat bench',
  ],
  squat: [
    'back squat',
    'front squat',
    'goblet squat',
    'squat',
    'barbell squat',
  ],
  deadlift: [
    'deadlift',
    'sumo deadlift',
    'romanian deadlift',
    'rdl',
    'conventional deadlift',
    'trap bar deadlift',
  ],
  overhead: [
    'overhead press',
    'military press',
    'shoulder press',
    'ohp',
    'standing press',
    'dumbbell shoulder press',
  ],
  row: [
    'barbell row',
    'dumbbell row',
    'cable row',
    'bent over row',
    'pendlay row',
    'seated row',
  ],
}

/**
 * Try to find a known max for an exercise by fuzzy matching
 * against the exercise categories and the user's max map.
 */
function findMaxForExercise(
  exerciseName: string,
  maxes: KnownMaxes
): number | null {
  const lower = exerciseName.toLowerCase()

  // Direct match against max keys
  if (maxes[lower] !== undefined) return maxes[lower]

  // Category match: find which category this exercise belongs to,
  // then check if the user has a max for that category
  for (const [category, variants] of Object.entries(EXERCISE_CATEGORIES)) {
    if (variants.some((v) => lower.includes(v) || v.includes(lower))) {
      if (maxes[category] !== undefined) return maxes[category]
    }
  }

  return null // unknown exercise, cannot validate
}

/**
 * Validate generated workout weights against known user maxes.
 * Returns an array of issues for weights outside the 20-120% range of known maxes.
 *
 * @param exercises - Array of exercises with names and weights from AI output
 * @param maxes - User's known maxes from coaching profile (JSON parsed)
 * @returns Array of weight issues (empty if all weights are reasonable)
 */
export function validateWorkoutWeights(
  exercises: Array<{ name: string; weight: number }>,
  maxes: KnownMaxes
): WeightIssue[] {
  const issues: WeightIssue[] = []

  for (const ex of exercises) {
    const knownMax = findMaxForExercise(ex.name, maxes)
    if (knownMax === null) continue // can't validate unknown exercises

    if (ex.weight > knownMax * 1.2) {
      issues.push({
        exercise: ex.name,
        weight: ex.weight,
        max: knownMax,
        issue: `Weight ${ex.weight}lbs exceeds 120% of known max (${knownMax}lbs)`,
      })
    }

    if (ex.weight < knownMax * 0.2 && ex.weight > 0) {
      issues.push({
        exercise: ex.name,
        weight: ex.weight,
        max: knownMax,
        issue: `Weight ${ex.weight}lbs is below 20% of known max (${knownMax}lbs) -- suspiciously low`,
      })
    }
  }

  return issues
}
