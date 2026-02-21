// Test workout generation endpoint
const BASE = 'http://localhost:3001'

async function main() {
  console.log('Testing workout generation...')
  const res = await fetch(`${BASE}/api/chat/generate-workout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Generate a simple push day workout with 3 exercises' }),
  })

  console.log('Status:', res.status)
  const data = await res.json()

  if (res.ok) {
    console.log('Workout saved with ID:', data.workout.id)
    console.log('Program:', data.plan.programName)
    console.log('Exercises:', data.plan.exercises.length)
    for (const ex of data.plan.exercises) {
      console.log(`  - ${ex.name}: ${ex.sets}x${ex.reps} @ ${ex.weight}lbs (rest: ${ex.restSeconds}s)`)
    }
    console.log('Warnings:', data.warnings.length > 0 ? data.warnings : 'None')
    console.log('\nWorkout generation test passed!')
  } else {
    console.error('Error:', data)
  }
}

main().catch(console.error)
