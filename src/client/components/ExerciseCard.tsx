import SetRow from './SetRow'
import type { WorkoutExercise } from './WorkoutView'

interface ExerciseCardProps {
  exercise: WorkoutExercise
  isActive: boolean
  completedSets: Set<string>
  onSetComplete: (setNumber: number) => void
  onStartRest: (seconds: number) => void
  onActualsChange: (setId: number, actualReps: number | null, actualWeight: number | null) => void
}

export default function ExerciseCard({
  exercise,
  isActive,
  completedSets,
  onSetComplete,
  onStartRest,
  onActualsChange,
}: ExerciseCardProps) {
  const sortedSets = [...exercise.sets].sort((a, b) => a.setNumber - b.setNumber)

  // Build the summary line, e.g. "4 sets x 8 reps @ 185 lbs"
  const firstSet = sortedSets[0]
  const summaryParts: string[] = []
  summaryParts.push(`${sortedSets.length} set${sortedSets.length !== 1 ? 's' : ''}`)
  if (firstSet?.reps) summaryParts.push(`${firstSet.reps} reps`)
  if (firstSet?.weight) summaryParts.push(`${firstSet.weight} lbs`)
  const summaryLine = summaryParts.join(' x ')

  const handleStartRest = () => {
    const restSeconds = exercise.restSeconds ?? 60
    onStartRest(restSeconds)
  }

  return (
    <div className={`exercise-card${isActive ? ' active' : ''}`}>
      <div className="exercise-header">
        <h3 className="exercise-name">{exercise.name}</h3>
        <p className="exercise-summary">{summaryLine}</p>
        {exercise.restSeconds && (
          <p className="exercise-rest">Rest: {exercise.restSeconds}s</p>
        )}
      </div>

      <div className="exercise-sets">
        {sortedSets.map(set => {
          const key = `${exercise.id}-${set.setNumber}`
          return (
            <SetRow
              key={set.id}
              set={set}
              isComplete={completedSets.has(key)}
              onComplete={() => {
                onSetComplete(set.setNumber)
                handleStartRest()
              }}
              onActualsChange={onActualsChange}
            />
          )
        })}
      </div>
    </div>
  )
}
