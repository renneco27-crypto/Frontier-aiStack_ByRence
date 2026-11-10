import type { Card } from '@/lib/zodSchemas'

export function computeAccuracy(correct: number, wrong: number): number {
  return correct + wrong === 0 ? 0 : Math.round((correct / (correct + wrong)) * 100)
}

export function computeProgress(masteredCount: number, total: number): number {
  return total === 0 ? 0 : Math.round((masteredCount / total) * 100)
}

export function getCardsByMastery(cards: Card[]): {
  mastered: Card[]
  learning: Card[]
  new: Card[]
} {
  return {
    mastered: cards.filter((c) => c.status === 'mastered'),
    learning: cards.filter((c) => c.status === 'learning'),
    new: cards.filter((c) => c.status === 'new'),
  }
}

export function getMasteryStars(mastery: number): {
  filled: number
  empty: number
} {
  return { filled: mastery, empty: 5 - mastery }
}

export function getStreakStatus(
  lastStudied: string | null
): 'today' | 'yesterday' | 'broken' | 'never' {
  if (!lastStudied) return 'never'

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  const studiedDate = lastStudied.split('T')[0]

  if (studiedDate === todayStr) return 'today'
  if (studiedDate === yesterdayStr) return 'yesterday'
  return 'broken'
}
