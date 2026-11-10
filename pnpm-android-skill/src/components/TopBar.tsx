'use client'

import { soundEngine } from '@/utils/soundEngine'

interface TopBarProps {
  title: string
  onBack?: () => void
  rightSlot?: React.ReactNode
}

export default function TopBar({ title, onBack, rightSlot }: TopBarProps) {
  return (
    <header className="h-13 bg-[#0b0c14] border-b border-[#1c1e2a] px-4 flex items-center justify-between gap-2 sticky top-0 z-40">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {onBack && (
          <button
            onClick={() => {
              soundEngine.play('thocky')
              onBack()
            }}
            className="w-8 h-8 flex items-center justify-center text-white active:scale-90 transition cursor-pointer shrink-0"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <h1 className="font-display text-[16px] font-extrabold text-white truncate tracking-tight">
          {title}
        </h1>
      </div>
      {rightSlot && <div className="flex items-center gap-1.5 shrink-0">{rightSlot}</div>}
    </header>
  )
}
