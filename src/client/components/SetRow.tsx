import { useState, useRef } from 'react'
import type { WorkoutSet } from './WorkoutView'

interface SetRowProps {
  set: WorkoutSet
  isComplete: boolean
  onComplete: () => void
  onActualsChange: (setId: number, actualReps: number | null, actualWeight: number | null) => void
}

export default function SetRow({ set, isComplete, onComplete, onActualsChange }: SetRowProps) {
  const [repsValue, setRepsValue] = useState(
    set.actualReps != null ? String(set.actualReps) : ''
  )
  const [weightValue, setWeightValue] = useState(
    set.actualWeight != null ? String(set.actualWeight) : ''
  )
  const repsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const weightTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleRepsChange = (value: string) => {
    setRepsValue(value)
    if (repsTimeout.current) clearTimeout(repsTimeout.current)
    repsTimeout.current = setTimeout(() => {
      const parsed = value === '' ? null : parseInt(value, 10)
      const reps = parsed != null && !isNaN(parsed) ? parsed : null
      const weight = weightValue === '' ? null : parseFloat(weightValue)
      onActualsChange(set.id, reps, weight != null && !isNaN(weight) ? weight : null)
    }, 500)
  }

  const handleWeightChange = (value: string) => {
    setWeightValue(value)
    if (weightTimeout.current) clearTimeout(weightTimeout.current)
    weightTimeout.current = setTimeout(() => {
      const parsed = value === '' ? null : parseFloat(value)
      const weight = parsed != null && !isNaN(parsed) ? parsed : null
      const reps = repsValue === '' ? null : parseInt(repsValue, 10)
      onActualsChange(set.id, reps != null && !isNaN(reps) ? reps : null, weight)
    }, 500)
  }

  return (
    <div className={`set-row${isComplete ? ' complete' : ''}`}>
      <span className="set-number">Set {set.setNumber}</span>

      <div className="set-details">
        <span className="set-prescribed">
          {set.reps != null && (
            <span className="set-reps">{set.reps} reps</span>
          )}
          {set.weight != null && (
            <span className="set-weight">{set.weight} lbs</span>
          )}
          {set.rpe != null && (
            <span className="set-rpe">RPE {set.rpe}</span>
          )}
        </span>

        <span className="set-actuals">
          <input
            type="number"
            className="set-actual-input"
            placeholder={set.reps != null ? String(set.reps) : 'Reps'}
            value={repsValue}
            onChange={e => handleRepsChange(e.target.value)}
            inputMode="numeric"
            min="0"
            aria-label="Actual reps"
          />
          <input
            type="number"
            className="set-actual-input"
            placeholder={set.weight != null ? String(set.weight) : 'lbs'}
            value={weightValue}
            onChange={e => handleWeightChange(e.target.value)}
            inputMode="decimal"
            min="0"
            step="any"
            aria-label="Actual weight"
          />
        </span>
      </div>

      <button
        className={`set-done-btn tap-target${isComplete ? ' complete' : ''}`}
        onClick={onComplete}
      >
        {isComplete ? 'Done' : 'Done'}
      </button>
    </div>
  )
}
