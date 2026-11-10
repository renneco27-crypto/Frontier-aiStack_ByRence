'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FlashcardSession } from '@/lib/zodSchemas'
import { SESSION_PERSIST_KEY } from '@/lib/constants'

interface SessionActions {
  setDeckId: (deckId: string) => void
  setCycleNumber: (n: number) => void
  setBatchIndex: (n: number) => void
  setCardIndex: (n: number) => void
  markCardCompleted: (cardId: string) => void
  clearCompletedIds: () => void
  setFlipped: (flipped: boolean) => void
  resetSession: () => void
}

const initialState: FlashcardSession = {
  deckId: null,
  cycleNumber: 1,
  batchIndex: 0,
  cardIndex: 0,
  completedCardIds: [],
  isFlipped: false,
}

export const useSessionStore = create<FlashcardSession & SessionActions>()(
  persist(
    (set) => ({
      ...initialState,
      setDeckId: (deckId) => set({ deckId }),
      setCycleNumber: (n) => set({ cycleNumber: n }),
      setBatchIndex: (n) => set({ batchIndex: n }),
      setCardIndex: (n) => set({ cardIndex: n }),
      markCardCompleted: (cardId) =>
        set((state) => ({
          completedCardIds: [...state.completedCardIds, cardId],
        })),
      clearCompletedIds: () => set({ completedCardIds: [] }),
      setFlipped: (flipped) => set({ isFlipped: flipped }),
      resetSession: () => set(initialState),
    }),
    {
      name: SESSION_PERSIST_KEY,
    }
  )
)
