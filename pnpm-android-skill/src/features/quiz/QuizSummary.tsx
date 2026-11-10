'use client'

import { useRouter } from 'next/navigation'
import { soundEngine } from '@/utils/soundEngine'

interface QuizSummaryProps {
  correct: number
  wrong: number
  total: number
  mode: string
  deckId: string
  onRetry: () => void
}

export default function QuizSummary({
  correct,
  wrong,
  total,
  mode,
  deckId,
  onRetry,
}: QuizSummaryProps) {
  const router = useRouter()
  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100)

  const message =
    accuracy >= 90
      ? { text: 'Excellent mastery.', color: '#1ed760' }
      : accuracy >= 70
        ? { text: 'Good progress.', color: '#9d7eff' }
        : { text: 'Keep practicing to master these cards.', color: '#8e92a8' }

  return (
    <div className="rounded-[28px] bg-[#1b0e3e] border-2 border-[#2f1e5e] p-8 max-w-sm mx-auto text-center shadow-2xl select-none">
      <p className="text-[12px] font-bold uppercase tracking-wider text-[#9d94ba]">{mode}</p>

      <p className="text-5xl font-extrabold text-white mt-3 font-display tracking-tight">
        {accuracy}%
      </p>
      <p className="text-[14px] font-semibold text-[#8e92a8] mt-2">
        {correct} correct out of {total}
      </p>

      <div className="h-3.5 rounded-full overflow-hidden bg-[#252736] mt-5 flex relative">
        <div
          className="h-full bg-[#1ed760] transition-all duration-300"
          style={{ width: `${(correct / total) * 100}%` }}
        />
        <div
          className="h-full bg-[#ff5252] transition-all duration-300"
          style={{ width: `${(wrong / total) * 100}%` }}
        />
      </div>

      <p className="mt-4 text-[14px] font-bold" style={{ color: message.color }}>
        {message.text}
      </p>

      <div className="mt-7 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            soundEngine.play('poppy')
            onRetry()
          }}
          className="h-12 w-full rounded-[14px] bg-[#7e57ff] border-2 border-[#9d7eff] shadow-[0px_3px_0px_0px_#4c2fb3] text-white font-extrabold text-[15px] tactile-btn cursor-pointer"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            soundEngine.play('thocky')
            router.push('/study/' + deckId)
          }}
          className="h-10 text-[14px] font-extrabold text-[#9d94ba] hover:text-white transition cursor-pointer"
        >
          Back to deck →
        </button>
      </div>
    </div>
  )
}
