'use client'

import React from 'react'

interface AnimatedFlameStreakProps {
  streak: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showCount?: boolean
  showLabel?: boolean
  className?: string
  glow?: boolean
}

const sizeMap = {
  sm: { flameSize: 20, fontSize: 'text-sm', textPadding: 'text-xs' },
  md: { flameSize: 28, fontSize: 'text-base', textPadding: 'text-xs' },
  lg: { flameSize: 42, fontSize: 'text-2xl', textPadding: 'text-sm' },
  xl: { flameSize: 56, fontSize: 'text-3xl', textPadding: 'text-base' },
}

export default function AnimatedFlameStreak({
  streak,
  size = 'md',
  showCount = true,
  showLabel = false,
  className = '',
  glow = true,
}: AnimatedFlameStreakProps) {
  const isLit = streak > 0
  const dims = sizeMap[size]

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {/* 3-Layered Animated Flame Icon */}
      <div className="relative flex items-center justify-center shrink-0">
        {/* Ambient Fire Aura Glow */}
        {glow && isLit && (
          <div
            className="absolute -inset-1 rounded-full blur-md opacity-75 pointer-events-none animate-pulse"
            style={{
              background: 'radial-gradient(circle, rgba(255,100,0,0.45) 0%, rgba(255,200,0,0.2) 60%, transparent 80%)',
            }}
          />
        )}

        <svg
          width={dims.flameSize}
          height={dims.flameSize * 1.25}
          viewBox="0 0 100 125"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`relative z-10 transition-all duration-300 ${!isLit ? 'opacity-40 grayscale' : ''}`}
        >
          <defs>
            {/* Layer 1: Outer Fire Gradient (Crimson -> Electric Orange) */}
            <linearGradient id="flameOuterGrad" x1="50" y1="120" x2="50" y2="5" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#d91b2b" />
              <stop offset="45%" stopColor="#ff4500" />
              <stop offset="85%" stopColor="#ff7b00" />
              <stop offset="100%" stopColor="#ffa600" />
            </linearGradient>

            {/* Layer 2: Middle Fire Gradient (Vibrant Amber -> Golden Sun) */}
            <linearGradient id="flameMidGrad" x1="50" y1="110" x2="50" y2="25" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ff4e00" />
              <stop offset="50%" stopColor="#ff9a00" />
              <stop offset="90%" stopColor="#ffd000" />
              <stop offset="100%" stopColor="#ffe600" />
            </linearGradient>

            {/* Layer 3: Inner Core Fire Gradient (Solar Yellow -> Pure White Core) */}
            <linearGradient id="flameInnerGrad" x1="50" y1="110" x2="50" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffaa00" />
              <stop offset="40%" stopColor="#fff066" />
              <stop offset="85%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>

            {/* Ember Particle Gradient */}
            <radialGradient id="emberGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#ffcc00" />
              <stop offset="100%" stopColor="#ff4500" />
            </radialGradient>
          </defs>

          {/* Floating Embers (Active only when lit) */}
          {isLit && (
            <>
              <circle cx="38" cy="40" r="3" fill="url(#emberGrad)" className="flame-ember-1" />
              <circle cx="64" cy="35" r="2.5" fill="url(#emberGrad)" className="flame-ember-2" />
            </>
          )}

          {/* LAYER 1: Outer Deep Crimson Flame */}
          <path
            d="M50 8C48 24 35 34 32 46C29 56 32 64 26 74C20 84 22 96 32 108C42 120 62 120 72 108C82 96 82 82 76 70C71 60 74 52 70 42C65 30 52 20 50 8Z"
            fill="url(#flameOuterGrad)"
            className={isLit ? 'flame-layer-outer' : ''}
          />

          {/* LAYER 2: Middle Radiant Orange / Golden Flame */}
          <path
            d="M50 28C48 40 38 48 37 60C35 70 41 78 38 88C43 98 57 100 63 94C70 87 71 78 66 68C62 60 63 52 61 44C58 35 52 32 50 28Z"
            fill="url(#flameMidGrad)"
            className={isLit ? 'flame-layer-middle' : ''}
          />

          {/* LAYER 3: Inner White-Hot Core Flame */}
          <path
            d="M50 52C48 60 42 66 43 74C44 82 48 88 52 88C56 88 60 82 59 74C58 66 53 60 50 52Z"
            fill="url(#flameInnerGrad)"
            className={isLit ? 'flame-layer-inner' : ''}
          />
        </svg>
      </div>

      {/* Streak Count & Label */}
      {showCount && (
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1">
            <span
              className={`font-display font-bold leading-none ${dims.fontSize} ${
                isLit
                  ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(255,140,0,0.35)]'
                  : 'text-[var(--color-text-muted)]'
              }`}
            >
              {streak}
            </span>
            {showLabel && (
              <span className={`font-medium ${dims.textPadding} text-[var(--color-text-muted)]`}>
                {streak === 1 ? 'day' : 'days'}
              </span>
            )}
          </div>
          {showLabel && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">
              Streak
            </span>
          )}
        </div>
      )}
    </div>
  )
}
