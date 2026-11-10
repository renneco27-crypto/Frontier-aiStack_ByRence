'use client'

import { RotateCcw } from 'lucide-react'

interface RestartButtonProps {
  onRestart: () => void
}

export default function RestartButton({ onRestart }: RestartButtonProps) {
  return (
    <button 
      onClick={onRestart}
      className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm transition-colors"
      title="Restart Session"
    >
      <RotateCcw size={18} />
    </button>
  )
}
