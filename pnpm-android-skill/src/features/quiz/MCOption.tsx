'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import MathFormattedText from '@/components/MathFormattedText'
import { soundEngine } from '@/utils/soundEngine'

type MCOptionState = 'default' | 'selected' | 'correct' | 'wrong' | 'reveal'

interface MCOptionProps {
  label: string
  text: string
  state: MCOptionState
  onClick: () => void
  disabled: boolean
}

const stateStyles: Record<MCOptionState, string> = {
  default:
    'bg-[#151722] border-[#222536] text-white hover:border-[#7e57ff]/60 hover:bg-[#1a1c29] cursor-pointer',
  selected:
    'bg-[#7e57ff]/20 border-[#7e57ff] text-white cursor-pointer',
  correct:
    'bg-[#102e22] border-[#1ed760] text-white shadow-[0_0_12px_rgba(30,215,96,0.2)]',
  wrong:
    'bg-[#381622] border-[#ff5252] text-white animate-shake',
  reveal:
    'bg-[#102e22] border-[#1ed760] text-white',
}

export default function MCOption({
  label,
  text,
  state,
  onClick,
  disabled,
}: MCOptionProps) {
  const showIcon = state === 'correct' || state === 'reveal' || state === 'wrong'

  return (
    <button
      type="button"
      onClick={() => {
        soundEngine.play('thocky')
        onClick()
      }}
      disabled={disabled}
      className={`w-full rounded-[16px] p-3.5 flex items-center gap-3 border-2 transition-all duration-200 text-left select-none tactile-btn ${
        stateStyles[state]
      } ${disabled ? 'pointer-events-none' : 'active:scale-[0.98]'}`}
    >
      <span className={`w-8 h-8 rounded-[10px] flex items-center justify-center text-[13px] font-extrabold shrink-0 border ${
        state === 'correct' || state === 'reveal'
          ? 'bg-[#1ed760]/20 border-[#1ed760] text-[#1ed760]'
          : state === 'wrong'
          ? 'bg-[#ff5252]/20 border-[#ff5252] text-[#ff5252]'
          : 'bg-[#1c1f2e] border-[#2a2d40] text-[#9d94ba]'
      }`}>
        {label}
      </span>
      <span className="flex-1 text-[15px] font-semibold text-white leading-snug">
        <MathFormattedText text={text} />
      </span>
      {showIcon && (state === 'correct' || state === 'reveal') && (
        <CheckCircle2 size={20} className="text-[#1ed760] shrink-0" />
      )}
      {state === 'wrong' && (
        <XCircle size={20} className="text-[#ff5252] shrink-0" />
      )}
    </button>
  )
}
