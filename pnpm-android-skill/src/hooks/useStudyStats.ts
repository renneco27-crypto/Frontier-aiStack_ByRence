'use client'

import { useEffect, useState } from 'react'
import { getCardsByDeck, getCardsForReview } from '@/db/cardRepository'
import { useStatsStore } from '@/store/statsStore'
import {
  computeAccuracy,
  computeProgress,
  getCardsByMastery,
} from '@/features/stats/statsCalculator'
import type { Card } from '@/lib/zodSchemas'

export function useStudyStats(deckId: string) {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const stats = useStatsStore((s) => s.stats[deckId])
  const [dueCount, setDueCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const allCards = await getCardsByDeck(deckId)
      if (cancelled) return
      setCards(allCards)

      const dueCards = await getCardsForReview(deckId, new Date())
      if (cancelled) return
      setDueCount(dueCards.length)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [deckId])

  const { mastered, learning, new: newCards } = getCardsByMastery(cards)

  const accuracy = computeAccuracy(
    stats?.correct ?? 0,
    stats?.wrong ?? 0
  )

  const totalCards = cards.length
  const masteredPercent = totalCards > 0 ? Math.round((mastered.length / totalCards) * 100) : 0
  const learningPercent = totalCards > 0 ? Math.round((learning.length / totalCards) * 100) : 0
  const progress = totalCards > 0 ? Math.round(((mastered.length + learning.length * 0.5) / totalCards) * 100) : 0

  return {
    stats,
    cards,
    masteredCount: mastered.length,
    learningCount: learning.length,
    newCount: newCards.length,
    masteredPercent,
    learningPercent,
    accuracy,
    progress,
    dueCount,
    loading,
  }
}
