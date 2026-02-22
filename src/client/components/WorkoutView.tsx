import { useState, useEffect, useCallback } from 'react'
import ExerciseCard from './ExerciseCard'

// ---------- Types ----------

export interface WorkoutSet {
  id: number
  setNumber: number
  reps: number | null
  weight: number | null
  rpe: number | null
  notes: string | null
  actualReps: number | null
  actualWeight: number | null
}

export interface WorkoutExercise {
  id: number
  name: string
  order: number
  restSeconds: number | null
  sets: WorkoutSet[]
}

export interface Workout {
  id: number
  date: string
  programName: string | null
  notes: string | null
  feedback: string | null
  exercises: WorkoutExercise[]
}

interface WorkoutViewProps {
  workoutId?: number | null
  onStartRest: (seconds: number) => void
}

export default function WorkoutView({ workoutId, onStartRest }: WorkoutViewProps) {
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0)
  const [completedSets, setCompletedSets] = useState<Set<string>>(new Set())

  const loadWorkout = useCallback(async (id?: number | null) => {
    setLoading(true)
    try {
      let targetId = id

      if (!targetId) {
        // Fetch most recent workout
        const listRes = await fetch('/api/workouts')
        if (!listRes.ok) throw new Error('Failed to fetch workouts')
        const workouts = await listRes.json()
        if (!workouts.length) {
          setWorkout(null)
          setLoading(false)
          return
        }
        targetId = workouts[0].id
      }

      // Fetch full workout details
      const res = await fetch(`/api/workouts/${targetId}`)
      if (!res.ok) throw new Error('Failed to fetch workout')
      const data: Workout = await res.json()
      setWorkout(data)
      setActiveExerciseIndex(0)
      setCompletedSets(new Set())
    } catch (err) {
      console.error('Failed to load workout:', err)
      setWorkout(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWorkout(workoutId)
  }, [workoutId, loadWorkout])

  // Auto-advance to the next exercise when all sets in the current one are completed
  useEffect(() => {
    if (!workout) return
    const sorted = [...workout.exercises].sort((a, b) => a.order - b.order)
    const currentExercise = sorted[activeExerciseIndex]
    if (!currentExercise || currentExercise.sets.length === 0) return

    const allSetsComplete = currentExercise.sets.every(set =>
      completedSets.has(`${currentExercise.id}-${set.setNumber}`)
    )

    if (allSetsComplete && activeExerciseIndex < sorted.length - 1) {
      setActiveExerciseIndex(activeExerciseIndex + 1)
    }
  }, [completedSets, activeExerciseIndex, workout])

  const handleSetComplete = useCallback((exerciseId: number, setNumber: number) => {
    const key = `${exerciseId}-${setNumber}`

    // Determine if this click is completing (not un-completing)
    const isCompleting = !completedSets.has(key)

    setCompletedSets(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })

    // Auto-advance when completing the last remaining set of the active exercise
    if (isCompleting && workout) {
      const sortedExercises = [...workout.exercises].sort((a, b) => a.order - b.order)
      const activeExercise = sortedExercises[activeExerciseIndex]

      if (activeExercise && activeExercise.id === exerciseId) {
        const allOtherSetsComplete = activeExercise.sets.every(s => {
          if (s.setNumber === setNumber) return true // the one we just completed
          return completedSets.has(`${exerciseId}-${s.setNumber}`)
        })

        if (allOtherSetsComplete && activeExerciseIndex < sortedExercises.length - 1) {
          setActiveExerciseIndex(activeExerciseIndex + 1)
        }
      }
    }
  }, [completedSets, workout, activeExerciseIndex])

  const handleActualsChange = useCallback(
    async (setId: number, actualReps: number | null, actualWeight: number | null) => {
      try {
        await fetch(`/api/workouts/sets/${setId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actualReps, actualWeight }),
        })
      } catch (err) {
        console.error('Failed to save actual values:', err)
      }
    },
    []
  )

  const handlePrevExercise = () => {
    setActiveExerciseIndex(prev => Math.max(0, prev - 1))
  }

  const handleNextExercise = () => {
    if (!workout) return
    setActiveExerciseIndex(prev => Math.min(workout.exercises.length - 1, prev + 1))
  }

  if (loading) {
    return (
      <div className="workout-empty">
        <p>Loading workout...</p>
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="workout-empty">
        <h2>No Workout Yet</h2>
        <p>Head to the Chat tab and ask your coach to generate a workout, or use the "Generate Workout" button.</p>
      </div>
    )
  }

  const sortedExercises = [...workout.exercises].sort((a, b) => a.order - b.order)

  return (
    <div className="workout-view">
      <div className="workout-header">
        <h2 className="workout-title">{workout.programName || 'Workout'}</h2>
        <p className="workout-date">{workout.date}</p>
      </div>

      <div className="workout-exercises">
        {sortedExercises.map((exercise, idx) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            isActive={idx === activeExerciseIndex}
            completedSets={completedSets}
            onSetComplete={(setNumber) => handleSetComplete(exercise.id, setNumber)}
            onStartRest={onStartRest}
            onActualsChange={handleActualsChange}
          />
        ))}
      </div>

      {sortedExercises.length > 1 && (
        <div className="workout-nav">
          <button
            className="btn-secondary tap-target"
            onClick={handlePrevExercise}
            disabled={activeExerciseIndex === 0}
          >
            Prev
          </button>
          <span className="workout-nav-indicator">
            {activeExerciseIndex + 1} / {sortedExercises.length}
          </span>
          <button
            className="btn-secondary tap-target"
            onClick={handleNextExercise}
            disabled={activeExerciseIndex === sortedExercises.length - 1}
          >
            Next
          </button>
        </div>
      )}

      {workout.notes && (
        <div className="workout-notes">
          <p>{workout.notes}</p>
        </div>
      )}
    </div>
  )
}
