'use client'

import React from 'react'
import { Volume2, VolumeX, Play, Pause, SkipForward, SkipBack, X } from 'lucide-react'
import { useTTS } from '@/hooks/useTTS'

interface TTSPlayerBarProps {
  title?: string
  className?: string
}

export default function TTSPlayerBar({ title = 'Narrator', className = '' }: TTSPlayerBarProps) {
  const {
    status,
    currentItemIndex,
    totalItems,
    currentSentenceText,
    rate,
    togglePlayPause,
    stop,
    nextItem,
    prevItem,
    setRate,
  } = useTTS()

  if (status === 'idle') return null

  const speeds = [0.8, 1.0, 1.25, 1.5]

  const cycleSpeed = () => {
    const currentIdx = speeds.indexOf(rate)
    const nextIdx = (currentIdx + 1) % speeds.length
    setRate(speeds[nextIdx])
  }

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-xl bg-[#151722] rounded-2xl border border-[var(--color-border-neon)] p-3 shadow-2xl animate-in slide-in-from-bottom-5 duration-200  ${className}`}
      style={{
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45), 0 0 15px var(--color-accent-soft)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Speaker icon & info */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="p-2 rounded-xl bg-[var(--color-accent)]/20 text-[var(--color-accent)] shrink-0 animate-pulse">
            <Volume2 size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                {title}
              </span>
              {totalItems > 0 && (
                <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                  {currentItemIndex + 1} / {totalItems}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-primary)] truncate font-medium mt-0.5">
              {currentSentenceText || 'Reading…'}
            </p>
          </div>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={prevItem}
            disabled={currentItemIndex === 0}
            className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] disabled:opacity-30 transition-colors"
            title="Previous item"
          >
            <SkipBack size={16} />
          </button>

          <button
            onClick={togglePlayPause}
            className="p-2.5 rounded-xl bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity shadow-md"
            title={status === 'playing' ? 'Pause' : 'Resume'}
          >
            {status === 'playing' ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>

          <button
            onClick={nextItem}
            disabled={currentItemIndex >= totalItems - 1}
            className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] disabled:opacity-30 transition-colors"
            title="Next item"
          >
            <SkipForward size={16} />
          </button>

          <button
            onClick={cycleSpeed}
            className="px-2 py-1 rounded-lg text-xs font-mono font-semibold bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors ml-1"
            title="Change playback speed"
          >
            {rate}x
          </button>

          <button
            onClick={stop}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-dontknow)] hover:bg-[var(--color-dontknow)]/10 transition-colors ml-1"
            title="Close audio player"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
