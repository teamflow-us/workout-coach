import type { WorkoutSet } from './WorkoutView'

interface SetRowProps {
  set: WorkoutSet
  isComplete: boolean
  onComplete: () => void
}

export default function SetRow({ set, isComplete, onComplete }: SetRowProps) {
  return (
    <div className={`set-row${isComplete ? ' complete' : ''}`}>
      <span className="set-number">Set {set.setNumber}</span>

      <span className="set-details">
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

      <button
        className={`set-done-btn tap-target${isComplete ? ' complete' : ''}`}
        onClick={onComplete}
      >
        {isComplete ? 'Done' : 'Done'}
      </button>
    </div>
  )
}
