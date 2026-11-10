'use client'

import { useEffect, useState } from 'react'
import MathFormattedText from '@/components/MathFormattedText'
import { soundEngine } from '@/utils/soundEngine'

interface ExplanationPanelProps {
  isTrue: boolean
  statement: string
  explanation: string
  userWasCorrect: boolean
  onNext: () => void
}

export default function ExplanationPanel({
  isTrue,
  statement,
  explanation,
  userWasCorrect,
  onNext,
}: ExplanationPanelProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : 'translate-y-full'
      } bg-[#151722] border-t-2 ${
        userWasCorrect ? 'border-[#1ed760]' : 'border-[#ff5252]'
      } shadow-[0_-12px_40px_rgba(0,0,0,0.9)]`}
    >
      <div className="max-w-[520px] mx-auto p-5 pb-safe">
        {/* Status header */}
        <div className="flex items-center gap-2.5 mb-2">
          {userWasCorrect ? (
            <div className="w-7 h-7 rounded-full bg-[#102e22] border-2 border-[#1ed760] flex items-center justify-center text-[#1ed760] shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#381622] border-2 border-[#ff5252] flex items-center justify-center text-[#ff5252] shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          )}
          <h3 className={`font-display text-[19px] font-extrabold tracking-tight ${
            userWasCorrect ? 'text-[#1ed760]' : 'text-[#ff5252]'
          }`}>
            {userWasCorrect ? 'Correct!' : 'Incorrect'}
          </h3>
        </div>

        {/* Crisp White Verdict */}
        <p className="text-[15px] font-bold text-white mb-2">
          {isTrue ? 'The statement is True.' : 'The statement is False.'}
        </p>

        {/* High-Contrast Explanation Body */}
        {explanation ? (
          <div className="text-[14px] text-[#f1f5f9] font-medium leading-relaxed bg-[#1c1f2e] border border-[#2a2d40] rounded-[16px] p-3.5 my-3 break-words">
            <MathFormattedText text={explanation} />
          </div>
        ) : null}

        {/* 3D Tactile Action Button */}
        <button
          type="button"
          onClick={() => {
            soundEngine.play('thocky')
            onNext()
          }}
          className={`h-12 w-full rounded-[14px] border-2 font-extrabold text-[15px] flex items-center justify-center gap-2 tactile-btn cursor-pointer mt-3 transition active:scale-95 text-white ${
            userWasCorrect
              ? 'bg-[#102e22] border-[#1ed760] shadow-[0px_4px_0px_0px_#0b1f17]'
              : 'bg-[#7e57ff] border-[#9d7eff] shadow-[0px_4px_0px_0px_#4c2fb3]'
          }`}
        >
          <span>Next</span>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  )
}
