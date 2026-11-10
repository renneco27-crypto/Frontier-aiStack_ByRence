'use client'

import React from 'react'

interface CircularLearningBarProps {
  percentage: number
  size?: number
  strokeWidth?: number
  showLabel?: boolean
  className?: string
}

export default function CircularLearningBar({
  percentage,
  size = 56,
  strokeWidth = 5,
  showLabel = true,
  className = '',
}: CircularLearningBarProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const validPercentage = Math.min(100, Math.max(0, percentage || 0))
  const strokeDashoffset = circumference - (validPercentage / 100) * circumference

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg] drop-shadow-[0_0_8px_rgba(168,85,247,0.3)]">
        {/* Track Background */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-[var(--color-surface-2)]"
          fill="transparent"
        />
        {/* Progress Value */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#learningBarGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="learningBarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
          <span className="text-[11px] font-bold text-[var(--color-text-primary)] font-['JetBrains_Mono']">
            {validPercentage}%
          </span>
        </div>
      )}
    </div>
  )
}
