'use client'

import type { FuseResult, FuseResultMatch } from 'fuse.js'
import type { Card } from '@/lib/zodSchemas'
import StatBadge from '@/components/StatBadge'

type RangeTuple = [number, number]

interface SearchResultProps {
  result: FuseResult<Card>
  deckTitle: string
  onClick: () => void
}

function highlightMatches(
  text: string,
  matches: readonly RangeTuple[] | undefined
): React.ReactNode {
  if (!matches || matches.length === 0) return text

  const sorted = [...matches].sort((a, b) => a[0] - b[0])
  const segments: { start: number; end: number; highlighted: boolean }[] = []
  let pos = 0

  for (const [start, end] of sorted) {
    if (start > pos) segments.push({ start: pos, end: start, highlighted: false })
    segments.push({ start, end: end + 1, highlighted: true })
    pos = end + 1
  }
  if (pos < text.length) segments.push({ start: pos, end: text.length, highlighted: false })

  return segments.map((seg, i) => {
    const content = text.slice(seg.start, seg.end)
    if (seg.highlighted) {
      return (
        <mark
          key={i}
          className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded px-0.5 not-italic"
        >
          {content}
        </mark>
      )
    }
    return content
  })
}

export default function SearchResult({ result, deckTitle, onClick }: SearchResultProps) {
  const card = result.item
  const frontMatches = result.matches?.find((m: FuseResultMatch) => m.key === 'front')?.indices
  const backMatches = result.matches?.find((m: FuseResultMatch) => m.key === 'back')?.indices

  return (
    <div
      onClick={onClick}
      className="bg-[#151722] rounded-xl border border-[var(--color-border)] p-4 cursor-pointer hover:border-[var(--color-border-neon)] transition-all "
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="uppercase text-[var(--color-text-muted)]">{card.chapter}</span>
        <StatBadge label={card.subject} value="" color="accent" />
      </div>
      <p className="text-base font-medium mt-1 text-[var(--color-text-primary)]">
        {highlightMatches(card.front, frontMatches)}
      </p>
      <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">
        {highlightMatches(card.back, backMatches)}
      </p>
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs text-[var(--color-text-muted)]">{deckTitle}</span>
        <span className="text-[var(--color-accent)] text-sm">→</span>
      </div>
    </div>
  )
}
