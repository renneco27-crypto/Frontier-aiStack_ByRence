import { syncEngine } from './syncEngine'
import { db } from './schema'
import { selectBestDistractors } from '@/features/quiz/distractorEngine'
import type { Deck, Card } from '@/lib/zodSchemas'
import { parseCSVFile } from '@/features/upload/csvParser'
import { auditAndFixCSV } from '@/features/upload/csvFixer'
import { getNativeDeckCSV, listNativeDecks, deleteNativeDeckCSV } from '@/lib/nativeDeckBridge'

export const DEMO_MATH_DECK_ID = 'demo-math-solver'
export const DEMO_CODING_DECK_ID = 'demo-coding-lab'

const deletedDeckIds = new Set<string>()

export async function ensureDemoDecks(): Promise<void> {
  try {
    // Purge demo decks — user doesn't want them. Mark as deleted in localStorage
    // so getDeck() never re-seeds them even if called by old code paths.
    if (typeof window !== 'undefined') {
      localStorage.setItem('studyup_deleted_demo_' + DEMO_MATH_DECK_ID, 'true')
      localStorage.setItem('studyup_deleted_demo_' + DEMO_CODING_DECK_ID, 'true')
    }
    await db.transaction('rw', [db.decks, db.cards], async () => {
      await db.decks.bulkDelete([DEMO_MATH_DECK_ID, DEMO_CODING_DECK_ID])
      await db.cards.where('deckId').equals(DEMO_MATH_DECK_ID).delete()
      await db.cards.where('deckId').equals(DEMO_CODING_DECK_ID).delete()
    })
  } catch (err) {
    console.warn('ensureDemoDecks purge warning:', err)
  }
}


export async function createDeck(deck: Deck): Promise<string> {
  deletedDeckIds.delete(deck.id)
  try {
    await db.transaction('rw', db.decks, db.syncQueue, async () => {
      await db.decks.add(deck)
      await syncEngine.enqueue({
        table: 'decks',
        action: 'create',
        recordId: deck.id,
        payload: deck,
      })
    })
    return deck.id
  } catch (err) {
    throw new Error(`Failed to create deck: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function synthesizeQuizItemsFromCards(cards: Card[], primarySubject: string = 'General'): any[] {
  const items: any[] = []
  const allCardAnswers = cards.map((c) => c.back || c.front).filter(Boolean)

  for (const c of cards) {
    const chapter = c.chapter || 'Chapter 1'
    const subject = c.subject || primarySubject

    if (c.mc_correct) {
      let distractors = [c.mc_distractor1, c.mc_distractor2, c.mc_distractor3].filter(Boolean) as string[]
      if (distractors.length < 3) {
        const pool = allCardAnswers.filter((a) => a !== c.mc_correct)
        distractors = selectBestDistractors(c.mc_correct, pool, 3)
      }
      items.push({
        mode: 'multiple_choice',
        question: c.front,
        correct: c.mc_correct,
        distractors: distractors.slice(0, 3),
        chapter,
        subject,
      })
    }

    if (c.tf_answer !== undefined && c.tf_answer !== '') {
      const isTrue = String(c.tf_answer).toLowerCase() === 'true'
      items.push({
        mode: 'true_false',
        statement: c.front,
        falseVersion: c.back || c.front,
        explanation: '',
        correct: isTrue,
        chapter,
        subject,
      })
    }

    if (c.enum_items) {
      const parts = c.enum_items.split(';').map((s) => s.trim().toLowerCase()).filter(Boolean)
      if (parts.length >= 2) {
        items.push({
          mode: 'enumeration',
          topic: c.front,
          items: parts,
          chapter,
          subject,
        })
      }
    }

    const idAns = c.id_answer || (c.type === 'definition' ? c.back : '')
    if (idAns) {
      const variants = c.id_variants ? c.id_variants.split(';').map((s) => s.trim()).filter(Boolean) : [idAns.toLowerCase().trim()]
      items.push({
        mode: 'identification',
        definition: c.front,
        answer: idAns,
        acceptVariants: variants,
        chapter,
        subject,
      })
    }
  }
  return items
}

export async function getDeck(deckId: string): Promise<Deck | undefined> {
  if (deletedDeckIds.has(deckId)) return undefined
  try {
    let deck = await db.decks.get(deckId)
    if (!deck && (deckId === DEMO_MATH_DECK_ID || deckId === DEMO_CODING_DECK_ID || deckId === 'demo-nextgen-features')) {
      await ensureDemoDecks()
      deck = await db.decks.get(deckId)
    }

    // Check if deck exists in native storage and auto-restore it on the fly
    if (!deck) {
      try {
        const nativeDeck = await getNativeDeckCSV(deckId)
        if (nativeDeck?.csvContent) {
          const parsed = parseCSVFile(auditAndFixCSV(nativeDeck.csvContent), nativeDeck.title)
          parsed.deck.id = deckId
          if (nativeDeck.subject) parsed.deck.subject = nativeDeck.subject
          const cardsWithDeckId = parsed.cards.map((c) => ({ ...c, deckId }))
          await db.transaction('rw', [db.decks, db.cards], async () => {
            await db.decks.put(parsed.deck)
            await db.cards.bulkPut(cardsWithDeckId)
          })
          deck = await db.decks.get(deckId)
        }
      } catch (nativeErr) {
        console.warn('Native deck auto-restore warning:', nativeErr)
      }
    }

    if (!deck) return undefined
    const cards = await db.cards.where('deckId').equals(deckId).toArray()
    let quizItems = deck.quizItems ?? []
    if (quizItems.length === 0 && cards.length > 0) {
      quizItems = synthesizeQuizItemsFromCards(cards, deck.subject)
    }
    return {
      ...deck,
      cards,
      quizItems,
    }
  } catch (err) {
    throw new Error(`Failed to get deck: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function getAllDecks(): Promise<Deck[]> {
  try {

    // Also sync any native decks that may not yet be in Dexie
    try {
      const nativeDecks = await listNativeDecks()
      if (nativeDecks.length > 0) {
        const existingIds = new Set((await db.decks.toArray()).map((d) => d.id))
        for (const nd of nativeDecks) {
          if (!existingIds.has(nd.id) && !deletedDeckIds.has(nd.id)) {
            const fullNative = await getNativeDeckCSV(nd.id)
            if (fullNative?.csvContent) {
              const parsed = parseCSVFile(auditAndFixCSV(fullNative.csvContent), fullNative.title)
              parsed.deck.id = nd.id
              if (fullNative.subject) parsed.deck.subject = fullNative.subject
              const cardsWithDeckId = parsed.cards.map((c) => ({ ...c, deckId: nd.id }))
              await db.transaction('rw', [db.decks, db.cards], async () => {
                await db.decks.put(parsed.deck)
                await db.cards.bulkPut(cardsWithDeckId)
              })
            }
          }
        }
      }
    } catch {}

    const existing = await db.decks
      .orderBy('uploadedAt')
      .reverse()
      .toArray()

    return existing
  } catch (err) {
    // If error occurs during seeding, safely return whatever decks exist
    try {
      const fallback = await db.decks.toArray()
      if (fallback.length > 0) return fallback
    } catch {}
    throw new Error(`Failed to get all decks: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function deleteDeck(deckId: string): Promise<void> {
  deletedDeckIds.add(deckId)
  try {
    await db.transaction('rw', [db.decks, db.cards, db.sessions, db.stats, db.cycleHistory, db.images], async () => {
      await db.decks.delete(deckId)
      await db.cards.where('deckId').equals(deckId).delete()
      await db.sessions.where('deckId').equals(deckId).delete()
      await db.stats.where('deckId').equals(deckId).delete()
      await db.cycleHistory.where('deckId').equals(deckId).delete()
      await db.images.where('deckId').equals(deckId).delete()
    })
    try {
      await deleteNativeDeckCSV(deckId)
    } catch {}
  } catch (err) {
    deletedDeckIds.delete(deckId)
    throw new Error(`Failed to delete deck: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function updateDeck(deckId: string, partial: Partial<Deck>): Promise<void> {
  try {
    await db.decks.update(deckId, partial)
  } catch (err) {
    throw new Error(`Failed to update deck: ${err instanceof Error ? err.message : String(err)}`)
  }
}

