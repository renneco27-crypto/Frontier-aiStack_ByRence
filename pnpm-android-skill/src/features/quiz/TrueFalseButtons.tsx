'use client'

import { soundEngine } from '@/utils/soundEngine'
import type { AnswerState } from '@/lib/zodSchemas'

interface TrueFalseButtonsProps {
  answerState: AnswerState
  userAnswer: boolean | null
  correctAnswer: boolean
  onAnswer: (answer: boolean) => void
}

export default function TrueFalseButtons({
  answerState,
  userAnswer,
  correctAnswer,
  onAnswer,
}: TrueFalseButtonsProps) {
  const disabled = answerState !== 'unanswered'

  const trueSelected = userAnswer === true
  const falseSelected = userAnswer === false

  const trueIsCorrect = correctAnswer === true
  const falseIsCorrect = correctAnswer === false

  return (
    <div className="flex gap-3 w-full">
      {/* TRUE BUTTON */}
      <button
        type="button"
        onClick={() => {
          soundEngine.play('poppy')
          onAnswer(true)
        }}
        disabled={disabled}
        className={`flex-1 flex flex-col items-center justify-center gap-2 rounded-[18px] py-4 px-3 border-2 font-extrabold text-white transition-all duration-200 tactile-btn select-none ${
          disabled
            ? trueSelected && trueIsCorrect
              ? 'bg-[#102e22] border-[#1ed760] shadow-[0px_4px_0px_0px_#0b1f17] ring-4 ring-[#1ed760]/40'
              : trueSelected && !trueIsCorrect
                ? 'bg-[#381622] border-[#ff5252] shadow-[0px_4px_0px_0px_#991b1b] animate-shake'
                : trueIsCorrect
                  ? 'bg-[#102e22] border-[#1ed760] shadow-[0px_4px_0px_0px_#0b1f17]'
                  : 'bg-[#151722] border-[#222536] opacity-50 shadow-none'
            : 'bg-[#102e22] border-[#1ed760] shadow-[0px_4px_0px_0px_#0b1f17] hover:brightness-110 active:scale-95 cursor-pointer'
        }`}
      >
        <div className="w-8 h-8 rounded-full border-2 border-white/80 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <span className="text-[16px] tracking-wide">True</span>
      </button>

      {/* FALSE BUTTON */}
      <button
        type="button"
        onClick={() => {
          soundEngine.play('thocky')
          onAnswer(false)
        }}
        disabled={disabled}
        className={`flex-1 flex flex-col items-center justify-center gap-2 rounded-[18px] py-4 px-3 border-2 font-extrabold text-white transition-all duration-200 tactile-btn select-none ${
          disabled
            ? falseSelected && falseIsCorrect
              ? 'bg-[#102e22] border-[#1ed760] shadow-[0px_4px_0px_0px_#0b1f17] ring-4 ring-[#1ed760]/40'
              : falseSelected && !falseIsCorrect
                ? 'bg-[#381622] border-[#ff5252] shadow-[0px_4px_0px_0px_#991b1b] animate-shake'
                : falseIsCorrect
                  ? 'bg-[#102e22] border-[#1ed760] shadow-[0px_4px_0px_0px_#0b1f17]'
                  : 'bg-[#151722] border-[#222536] opacity-50 shadow-none'
            : 'bg-[#381622] border-[#ff5252] shadow-[0px_4px_0px_0px_#991b1b] hover:brightness-110 active:scale-95 cursor-pointer'
        }`}
      >
        <div className="w-8 h-8 rounded-full border-2 border-white/80 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <span className="text-[16px] tracking-wide">False</span>
      </button>
    </div>
  )
}
