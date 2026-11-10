import { shuffleSeeded } from '@/lib/shuffleSeeded'
import type { Card, FlashcardSession } from '@/lib/zodSchemas'
import { BATCH_SIZE } from '@/lib/constants'

export function buildCycle(cards: Card[], cycleNumber: number): Card[][] {
  const shuffled = shuffleSeeded([...cards], cycleNumber)
  shuffled.sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))
  const cycle: Card[][] = []
  for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
    cycle.push(shuffled.slice(i, i + BATCH_SIZE))
  }
  return cycle
}

export function getResumePosition(
  cycle: Card[][],
  session: FlashcardSession
): { batchIndex: number; cardIndex: number } {
  if (session.completedCardIds.length === 0) {
    return { batchIndex: 0, cardIndex: 0 }
  }

  const completedSet = new Set(session.completedCardIds)
  for (let b = 0; b < cycle.length; b++) {
    for (let c = 0; c < cycle[b].length; c++) {
      if (!completedSet.has(cycle[b][c].id)) {
        return { batchIndex: b, cardIndex: c }
      }
    }
  }

  return { batchIndex: cycle.length - 1, cardIndex: cycle[cycle.length - 1].length - 1 }
}
