'use client'

import { Search, X } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
}

export default function SearchBar({ value, onChange, onClear }: SearchBarProps) {
  return (
    <div className="relative w-full">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search cards…"
        autoFocus
        className="w-full rounded-xl border border-[var(--color-border)] pl-10 pr-10 py-3 text-base font-['JetBrains_Mono'] bg-[var(--color-surface-2)] focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_10px_rgba(255,45,133,0.18)] placeholder:text-[var(--color-text-muted)] text-[var(--color-text-primary)] transition-shadow"
      />
      {value.length > 0 && (
        <button
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
