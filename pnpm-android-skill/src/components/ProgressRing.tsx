'use client'

interface ProgressRingProps {
  value?: number
  masteredPercent?: number
  learningPercent?: number
  size?: number
  strokeWidth?: number
  color?: string
}

export default function ProgressRing({
  value,
  masteredPercent,
  learningPercent,
  size = 64,
  strokeWidth = 6,
  color = 'var(--color-know)',
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const hasSegmented = masteredPercent !== undefined || learningPercent !== undefined
  const mPct = Math.min(Math.max(masteredPercent ?? value ?? 0, 0), 100)
  const lPct = Math.min(Math.max(learningPercent ?? 0, 0), 100 - mPct)

  const masteredDash = (mPct / 100) * circumference
  const learningDash = (lPct / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="var(--color-border)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Learning arc (amber) */}
      {hasSegmented && learningDash > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-mastered)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${learningDash} ${circumference}`}
          strokeDashoffset={-masteredDash}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      )}
      {/* Mastered arc (green or custom color) */}
      {masteredDash > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${masteredDash} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      )}
    </svg>
  )
}
