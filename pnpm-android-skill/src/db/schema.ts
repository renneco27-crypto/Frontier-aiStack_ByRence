import Dexie, { type Table } from 'dexie'
import type { Deck, Card, FlashcardSession, DeckStats, CycleHistoryEntry, DeckImage } from '@/lib/zodSchemas'

export interface SyncQueueItem {
  id?: number
  table: 'decks' | 'cards' | 'sessions' | 'stats'
  action: 'create' | 'update' | 'delete'
  recordId: string
  payload?: any
  timestamp: number
  status: 'pending' | 'syncing' | 'failed'
  retryCount: number
  lastError?: string
}

export class StitchDB extends Dexie {
  decks!: Table<Deck, string>
  cards!: Table<Card, string>
  sessions!: Table<FlashcardSession, string>
  stats!: Table<DeckStats, string>
  cycleHistory!: Table<CycleHistoryEntry, number>
  images!: Table<DeckImage, string>
  syncQueue!: Table<SyncQueueItem, number>

  constructor() {
    super('StitchDB')
    this.version(1).stores({
      decks: '++id, title, subject, uploadedAt',
      cards: '++id, deckId, status, mastery, know, nextReview',
      sessions: '++id, deckId',
      stats: '++id, deckId',
      cycleHistory: '++id, deckId, cycleNumber',
    })
    this.version(2).stores({
      decks: '++id, title, subject, uploadedAt',
      cards: '++id, deckId, status, mastery, know, nextReview',
      sessions: '++id, deckId',
      stats: '++id, deckId',
      cycleHistory: '++id, deckId, cycleNumber',
      images: '++id, deckId, createdAt',
    })
    // v3: drop images — Dexie cannot change PK type in-place; must delete first.
    this.version(3).stores({
      decks: '++id, title, subject, uploadedAt',
      cards: '++id, deckId, status, mastery, know, nextReview',
      sessions: '++id, deckId',
      stats: '++id, deckId',
      cycleHistory: '++id, deckId, cycleNumber',
      images: null,
    })
    // v4: recreate images with correct user-supplied UUID primary key.
    this.version(4).stores({
      decks: '++id, title, subject, uploadedAt',
      cards: '++id, deckId, status, mastery, know, nextReview',
      sessions: '++id, deckId',
      stats: '++id, deckId',
      cycleHistory: '++id, deckId, cycleNumber',
      images: 'id, deckId, createdAt',
    })
    // v5: add outbox syncQueue for background sync to Supabase
    this.version(5).stores({
      decks: '++id, title, subject, uploadedAt',
      cards: '++id, deckId, status, mastery, know, nextReview',
      sessions: '++id, deckId',
      stats: '++id, deckId',
      cycleHistory: '++id, deckId, cycleNumber',
      images: 'id, deckId, createdAt',
      syncQueue: '++id, table, action, recordId, timestamp, status',
    })
  }
}

export const db = new StitchDB()
