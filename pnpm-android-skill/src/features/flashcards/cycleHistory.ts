import { db } from '@/db/schema'

export async function appendCycleResult(
  deckId: string,
  cycleNumber: number,
  knownIds: string[],
  unknownIds: string[]
): Promise<void> {
  await db.cycleHistory.add({
    deckId,
    cycleNumber,
    completedAt: new Date().toISOString(),
    knownIds,
    unknownIds,
    knownCount: knownIds.length,
    unknownCount: unknownIds.length,
  })
}
