interface FlashcardProgressProps {
  cardIndex: number
  batchSize: number
  batchIndex?: number
  totalBatches?: number
}

/**
 * Gold-standard study progress bar (flashcards). Every study mode reuses this
 * exact markup via StudyProgressBar so all /study screens share one bar.
 */
export function StudyProgressBar({ percent }: { percent: number }) {
  const width = Math.min(100, Math.max(0, percent))
  return (
    <div
      className="flex-1 h-[14px] bg-[#252736] rounded-full overflow-hidden relative"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
    >
      <div
        className="h-full bg-[#7e57ff] rounded-full transition-all duration-300 relative"
        style={{ width: `${width}%` }}
      >
        <div className="absolute top-[2.5px] left-2 right-2 h-[3.5px] bg-[#9d7eff] rounded-full opacity-80" />
      </div>
    </div>
  )
}

export default function FlashcardProgress({ cardIndex, batchSize }: FlashcardProgressProps) {
  const percent = batchSize > 0 ? Math.max(8, ((cardIndex + 1) / batchSize) * 100) : 25
  return <StudyProgressBar percent={percent} />
}
