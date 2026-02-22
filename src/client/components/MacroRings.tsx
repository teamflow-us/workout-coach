import type { NutritionGoals, DailyTotals } from '../../shared/types/nutrition.js'

interface MacroRingsProps {
  totals: DailyTotals
  goals: NutritionGoals
}

interface RingConfig {
  label: string
  value: number
  target: number
  color: string
  unit: string
}

function Ring({ label, value, target, color, unit }: RingConfig) {
  const size = 72
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(value / Math.max(target, 1), 1)
  const offset = circumference * (1 - pct)

  return (
    <div className="macro-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--line-soft)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 400ms ease' }}
        />
      </svg>
      <div className="macro-ring-value">
        {Math.round(value)}<span className="macro-ring-unit">{unit}</span>
      </div>
      <div className="macro-ring-label">{label}</div>
      <div className="macro-ring-target">/ {target}</div>
    </div>
  )
}

export default function MacroRings({ totals, goals }: MacroRingsProps) {
  const rings: RingConfig[] = [
    { label: 'Calories', value: totals.calories, target: goals.caloriesTarget, color: 'var(--color-accent)', unit: '' },
    { label: 'Protein', value: totals.protein, target: goals.proteinTarget, color: 'var(--color-accent-cool)', unit: 'g' },
    { label: 'Carbs', value: totals.carbs, target: goals.carbsTarget, color: 'var(--color-warning)', unit: 'g' },
    { label: 'Fat', value: totals.fat, target: goals.fatTarget, color: 'var(--color-danger)', unit: 'g' },
  ]

  return (
    <div className="macro-rings">
      {rings.map((ring) => (
        <Ring key={ring.label} {...ring} />
      ))}
    </div>
  )
}
