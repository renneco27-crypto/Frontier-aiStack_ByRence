'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { soundEngine } from '@/utils/soundEngine'

interface SessionEndCardProps {
  knownCount: number
  unknownCount: number
  totalCards: number
  deckId: string
  cycleNumber: number
  hasMoreBatches: boolean
  onNextBatch: () => void
  onResetCycle: () => void
}

export default function SessionEndCard({
  knownCount,
  unknownCount,
  deckId,
  hasMoreBatches,
  onNextBatch,
  onResetCycle,
}: SessionEndCardProps) {
  const router = useRouter()
  const [step, setStep] = useState<'missed' | 'results'>(unknownCount > 0 ? 'missed' : 'results')

  const accuracy =
    knownCount + unknownCount > 0
      ? Math.round((knownCount / (knownCount + unknownCount)) * 100)
      : 100
  const earnedXp = Math.max(15, knownCount * 15)

  if (step === 'missed') {
    return (
      <div className="w-full h-full flex flex-col justify-between py-2 relative overflow-hidden">
        <div className="flex-1 flex items-center justify-center relative">
          <div className="flex items-center w-full pl-6 pr-0 relative">
            <div className="bg-[#232533] text-white px-5 py-4 rounded-[20px] max-w-[215px] text-[15.5px] font-medium leading-snug relative shadow-lg">
              Let&apos;s correct the questions you missed!
              <div className="w-3.5 h-3.5 bg-[#232533] rotate-45 absolute -right-1.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Peeking Mascot (1:1 Reference) */}
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 peek-right-anim">
              <img
                src="/assets/images/mascot.png"
                alt="StudyUp Mascot"
                className="w-28 h-28 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-4">
          <button
            data-slot="button"
            data-variant="default"
            onClick={() => {
              soundEngine.play('poppy')
              setStep('results')
            }}
            className="w-full h-12 px-5 rounded-[16px] border-2 border-[#9333ea] bg-[#9333ea] text-white font-extrabold text-[15px] uppercase tracking-wide shadow-[0px_4px_0px_0px_#6b21a8] tactile-btn cursor-pointer"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.play('thocky')
              setStep('results')
            }}
            className="w-full py-2.5 text-[14px] font-extrabold text-[#8e92a8] hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Skip to results</span>
            <span>&rarr;</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col justify-between pt-4 pb-2">
      <div className="h-2" />
      <div className="flex flex-col items-center">
        <div className="mascot-rise-anim mb-4 flex justify-center">
          <img
            src="/assets/images/mascot_with_hat.png"
            alt="StudyUp Mascot with Hat"
            className="w-36 h-36 object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.55)]"
          />
        </div>

        <h2 className="font-display text-[28px] font-extrabold text-white tracking-tight mb-6">
          {accuracy >= 80 ? 'Great job!' : "It's a start..."}
        </h2>

        {/* Stat Cards Row (1:1 Reference: XP + Accuracy) */}
        <div className="w-full flex items-center gap-3.5 justify-center px-1">
          <div className="w-[112px] h-[68px] rounded-[18px] bg-[#0e1b33] border-2 border-[#2b7fff] relative flex items-center justify-center pt-2">
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#2b7fff] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wider">
              XP
            </div>
            <div className="flex items-center gap-1.5 text-white font-extrabold text-[19px]">
              <svg className="w-5 h-5 text-[#2b7fff]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span>+{earnedXp}</span>
            </div>
          </div>

          <div className="w-[112px] h-[68px] rounded-[18px] bg-[#0c291e] border-2 border-[#1ed760] relative flex items-center justify-center">
            <div className="flex items-center gap-1.5 text-white font-extrabold text-[19px]">
              <svg
                className="w-5 h-5 text-[#1ed760]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="4" />
                <path d="M19 5l-7 7" />
              </svg>
              <span>{accuracy}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4">
        <button
          data-slot="button"
          data-variant="secondary"
          data-size="icon-lg"
          onClick={() => {
            soundEngine.play('thocky')
            router.push('/study/' + deckId)
          }}
          className="w-[52px] h-[52px] rounded-[16px] border-2 border-[#222536] bg-[#1c1f2e] shadow-[0px_4px_0px_0px_#121420] flex items-center justify-center text-white shrink-0 tactile-btn cursor-pointer"
          title="Back to Deck"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        <button
          data-slot="button"
          data-variant="default"
          onClick={() => {
            soundEngine.play('poppy')
            if (hasMoreBatches) {
              onNextBatch()
            } else {
              onResetCycle()
            }
          }}
          className="flex-1 h-[52px] px-5 rounded-[16px] border-2 border-[#9333ea] bg-[#9333ea] text-white font-extrabold text-[15px] uppercase tracking-wide shadow-[0px_4px_0px_0px_#6b21a8] tactile-btn cursor-pointer"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
