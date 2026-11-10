'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Star } from 'lucide-react'
import type { Card } from '@/lib/zodSchemas'
import { getMasteryStars } from './statsCalculator'

interface CardMasteryListProps {
  cards: Card[]
  deckId: string
  defaultExpanded?: boolean
}

export default function CardMasteryList({ cards, deckId, defaultExpanded = false }: CardMasteryListProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showAll, setShowAll] = useState(false)
  const router = useRouter()

  const sorted = [...cards].sort((a, b) => a.mastery - b.mastery)
  const display = showAll ? sorted : sorted.slice(0, 10)

  return (
    <div className="border-t border-b border-[#222536] py-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full cursor-pointer py-1 text-left"
      >
        <span className="text-[14px] font-extrabold text-white tracking-tight">
          Card mastery <span className="text-[#8e92a8] text-[12px] font-semibold">({cards.length})</span>
        </span>
        <ChevronDown
          size={16}
          className="text-[#8e92a8] transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {expanded && (
        <div className="mt-3 divide-y divide-[#1c1e2a]">
          {display.map((card, i) => {
            const stars = getMasteryStars(card.mastery)
            return (
              <div
                key={card.id}
                className="flex items-center gap-3 py-2.5"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <span className="text-[13px] text-white flex-1 truncate max-w-[200px]">
                  {card.front.length > 36 ? card.front.slice(0, 36) + '…' : card.front}
                </span>
                <span className="flex gap-0.5 text-xs text-[#f59e0b]">
                  {Array.from({ length: stars.filled }).map((_, i) => (
                    <Star key={`f-${i}`} size={12} className="fill-[#f59e0b]" />
                  ))}
                  {Array.from({ length: stars.empty }).map((_, i) => (
                    <Star key={`e-${i}`} size={12} className="text-[#25283c]" />
                  ))}
                </span>
                <span className="text-xs font-bold text-[#1ed760]">✓{card.correctCount}</span>
                <span className="text-xs font-bold text-[#ff5252]">✕{card.wrongCount}</span>
              </div>
            )
          })}

          {sorted.length > 10 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="text-xs text-[#8e92a8] pt-2 hover:text-white transition cursor-pointer block"
            >
              Show all {cards.length} cards ↓
            </button>
          )}

          <button
            onClick={() => router.push('/study/' + deckId + '/flashcards')}
            className="text-[#a78bfa] text-xs font-bold pt-3 hover:text-white transition cursor-pointer block"
          >
            Study weak cards →
          </button>
        </div>
      )}
    </div>
  )
}
