'use client'

import { soundEngine } from '@/utils/soundEngine'

interface FlashcardControlsProps {
  isFlipped: boolean
  isFirst: boolean
  isLast: boolean
  isAnimating: boolean
  swipeHint?: 'know' | 'dontknow' | null
  /** Tallies now live beside the progress bar in StudyHeader; kept for API compatibility. */
  knownCount?: number
  unknownCount?: number
  onPrev: () => void
  onNext: () => void
  onKnow: () => void
  onDontKnow: () => void
}

export default function FlashcardControls({
  isFirst,
  isAnimating,
  swipeHint,
  onPrev,
  onKnow,
  onDontKnow,
}: FlashcardControlsProps) {
  return (
    <div className="flex items-center gap-3 px-1 pt-1 pb-safe shrink-0">
      {/* Undo: bare icon, secondary to the two answer actions */}
      <button
        type="button"
        onClick={() => {
          soundEngine.play('thocky')
          onPrev()
        }}
        disabled={isFirst || isAnimating}
        className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-[#d8dbe8] hover:text-white active:scale-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7e57ff] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        title="Undo previous card"
        aria-label="Undo previous card"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10h11a5 5 0 0 1 0 10H9" />
          <path d="M7 6L3 10l4 4" />
        </svg>
      </button>

      {/* Answer actions (3D Maia Red #381622 & Green #102e22) */}
      <button
        type="button"
        onClick={() => {
          soundEngine.play('thocky', 18)
          onDontKnow()
        }}
        disabled={isAnimating}
        className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-[14px] bg-[#381622] border-2 border-[#ff5252] shadow-[0px_3px_0px_0px_#991b1b] tactile-btn cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5252]/60 disabled:opacity-50 transition-transform ${
          swipeHint === 'dontknow' ? 'scale-105' : ''
        }`}
      >
        <svg className="w-4 h-4 text-[#ff5a5a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
        <span className="text-[14px] font-extrabold text-white">Still learning</span>
      </button>

      <button
        type="button"
        onClick={() => {
          soundEngine.play('poppy', 18)
          onKnow()
        }}
        disabled={isAnimating}
        className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-[14px] bg-[#102e22] border-2 border-[#1ed760] shadow-[0px_3px_0px_0px_#0b1f17] tactile-btn cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/60 disabled:opacity-50 transition-transform ${
          swipeHint === 'know' ? 'scale-105' : ''
        }`}
      >
        <svg className="w-4 h-4 text-[#1ed760]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.5l2.2 2.2 4.8-4.8" />
        </svg>
        <span className="text-[14px] font-extrabold text-white">Know</span>
      </button>
    </div>
  )
}