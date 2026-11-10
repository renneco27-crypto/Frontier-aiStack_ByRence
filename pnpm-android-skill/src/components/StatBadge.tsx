'use client'

interface StatBadgeProps {
  label: string
  value: string | number
  color: 'know' | 'dontknow' | 'mastered' | 'new' | 'accent' | 'muted'
}

const colorMap: Record<StatBadgeProps['color'], { bg: string; text: string }> = {
  know: { bg: 'var(--color-know-soft)', text: 'var(--color-know)' },
  dontknow: { bg: 'var(--color-dontknow-soft)', text: 'var(--color-dontknow)' },
  mastered: { bg: 'var(--color-mastered-soft)', text: 'var(--color-mastered)' },
  new: { bg: 'var(--color-new-soft)', text: 'var(--color-new)' },
  accent: { bg: 'var(--color-accent-soft)', text: 'var(--color-accent)' },
  muted: { bg: 'var(--color-surface-2)', text: 'var(--color-text-muted)' },
}

export default function StatBadge({ label, value, color }: StatBadgeProps) {
  const colors = colorMap[color]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {value !== '' && value !== undefined && value !== null && <span>{value}</span>}
      <span>{label}</span>
    </span>
  )
}
