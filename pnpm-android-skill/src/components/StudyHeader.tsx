'use client'

import type { ReactNode } from 'react'
import { soundEngine } from '@/utils/soundEngine'
import { StudyProgressBar } from '@/features/flashcards/FlashcardProgress'

/**
 * Shared header for every /study mode, modelled on the flashcards screen
 * (the gold standard): bare close icon, the purple progress bar, the
 * still-learning / know tallies flanking the bar, and bare utility icons.
 * Header icons are never boxed (ui-laws 4b).
 */
interface StudyHeaderProps {
  onClose: () => void
  /** 'close' = X (session screens), 'back' = chevron (browse screens) */
  closeIcon?: 'close' | 'back'
  /** 0-100. When omitted the title is shown instead of the bar. */
  percent?: number
  title?: string
  /** Wrong / still-learning tally, shown left of the bar */
  unknownCount?: number
  /** Correct / know tally, shown right of the bar */
  knownCount?: number
  rightSlot?: ReactNode
  className?: string
}

export function TallyCount({ kind, value }: { kind: 'know' | 'dontknow'; value: number }) {
  const isKnow = kind === 'know'
  return (
    <span
      className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-[10px] text-[13px] font-extrabold tabular-nums shrink-0 border select-none ${
        isKnow
          ? 'bg-[#102e22] text-[#1ed760] border-[#1ed760]/40 shadow-[0_1px_3px_rgba(0,0,0,0.5)]'
          : 'bg-[#381622] text-[#ff5252] border-[#ff5252]/40 shadow-[0_1px_3px_rgba(0,0,0,0.5)]'
      }`}
      aria-label={`${value} ${isKnow ? 'known' : 'still learning'}`}
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        {isKnow ? <path d="M8.5 12.5l2.2 2.2 4.8-4.8" /> : <path d="M15 9l-6 6M9 9l6 6" />}
      </svg>
      {value}
    </span>
  )
}

/** Bare header icon (no box, no fill). Active state uses the accent color only. */
export function HeaderIconButton({
  onClick,
  title,
  active = false,
  disabled = false,
  children,
}: {
  onClick: () => void
  title: string
  active?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => {
        soundEngine.play('thocky')
        onClick()
      }}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors active:scale-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7e57ff] disabled:opacity-30 disabled:pointer-events-none ${
        active ? 'text-[#9d7eff]' : 'text-[#d8dbe8] hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

export default function StudyHeader({
  onClose,
  closeIcon = 'close',
  percent,
  title,
  unknownCount,
  knownCount,
  rightSlot,
  className = '',
}: StudyHeaderProps) {
  const hasBar = typeof percent === 'number'
  return (
    <div className={`flex items-center gap-2.5 px-1 py-2 shrink-0 ${className}`}>
      <HeaderIconButton onClick={onClose} title={closeIcon === 'close' ? 'Close' : 'Back'}>
        {closeIcon === 'close' ? (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        )}
      </HeaderIconButton>

      {hasBar ? (
        <>
          {typeof unknownCount === 'number' && <TallyCount kind="dontknow" value={unknownCount} />}
          <StudyProgressBar percent={percent as number} />
          {typeof knownCount === 'number' && <TallyCount kind="know" value={knownCount} />}
        </>
      ) : (
        <h1 className="flex-1 min-w-0 font-display text-[16px] font-extrabold text-white truncate tracking-tight">
          {title}
        </h1>
      )}

      {rightSlot && <div className="flex items-center shrink-0 -mr-1">{rightSlot}</div>}
    </div>
  )
}
