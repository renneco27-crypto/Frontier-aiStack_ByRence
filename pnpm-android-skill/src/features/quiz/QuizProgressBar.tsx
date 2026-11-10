import { StudyProgressBar } from '@/features/flashcards/FlashcardProgress'

interface QuizProgressBarProps {
  current: number
  total: number
  correct: number
  wrong: number
}

export default function QuizProgressBar({
  current,
  total,
  correct,
  wrong,
}: QuizProgressBarProps) {
  const percent = total > 0 ? (current / total) * 100 : 0
  const accuracy = correct + wrong === 0 ? 0 : Math.round((correct / (correct + wrong)) * 100)

  return (
    <div className="w-full px-4 py-2">
      <StudyProgressBar percent={percent} />
      <div className="flex justify-between text-xs text-[#8e92a8] font-semibold px-1 pt-1.5">
        <span>Question {current} of {total}</span>
        <span className="flex items-center gap-2">
          <span className="text-[#1ed760] font-bold">✓ {correct}</span>
          <span>·</span>
          <span className="text-[#ff5252] font-bold">✕ {wrong}</span>
        </span>
        <span>{accuracy}%</span>
      </div>
    </div>
  )
}
