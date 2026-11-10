import { db } from './schema'
import type { FlashcardSession } from '@/lib/zodSchemas'

export async function saveSession(session: FlashcardSession): Promise<void> {
  try {
    await db.sessions.put(session)
  } catch (err) {
    throw new Error(`Failed to save session: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function loadSession(deckId: string): Promise<FlashcardSession | undefined> {
  try {
    return await db.sessions.where('deckId').equals(deckId).first()
  } catch (err) {
    throw new Error(`Failed to load session: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function clearSession(deckId: string): Promise<void> {
  try {
    await db.sessions.where('deckId').equals(deckId).delete()
  } catch (err) {
    throw new Error(`Failed to clear session: ${err instanceof Error ? err.message : String(err)}`)
  }
}
