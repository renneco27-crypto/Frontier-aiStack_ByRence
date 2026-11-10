import { db } from './schema'
import type { Card } from '@/lib/zodSchemas'

export async function createCards(cards: Card[]): Promise<void> {
  try {
    await db.cards.bulkAdd(cards)
  } catch (err) {
    throw new Error(`Failed to create cards: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function getCardsByDeck(deckId: string): Promise<Card[]> {
  try {
    return await db.cards.where('deckId').equals(deckId).toArray()
  } catch (err) {
    throw new Error(`Failed to get cards: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function getCard(cardId: string): Promise<Card | undefined> {
  try {
    return await db.cards.get(cardId)
  } catch (err) {
    throw new Error(`Failed to get card: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function updateCard(cardId: string, partial: Partial<Card>): Promise<void> {
  try {
    await db.cards.update(cardId, partial)
  } catch (err) {
    throw new Error(`Failed to update card: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function getCardsForReview(deckId: string, today: Date): Promise<Card[]> {
  try {
    const allCards = await getCardsByDeck(deckId)
    const todayStr = today.toISOString()
    return allCards.filter(
      (c) => c.nextReview === null || c.nextReview <= todayStr
    )
  } catch (err) {
    throw new Error(`Failed to get cards for review: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function deleteCard(cardId: string): Promise<void> {
  try {
    await db.cards.delete(cardId)
  } catch (err) {
    throw new Error(`Failed to delete card: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function bulkDeleteCards(cardIds: string[]): Promise<void> {
  try {
    await db.cards.bulkDelete(cardIds)
  } catch (err) {
    throw new Error(`Failed to delete cards: ${err instanceof Error ? err.message : String(err)}`)
  }
}
