'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { computeAccuracy } from '@/features/stats/statsCalculator'
import type { DeckStats, StudyMode } from '@/lib/zodSchemas'
import { STATS_PERSIST_KEY } from '@/lib/constants'

interface StatsState {
  stats: Record<string, DeckStats>
}

interface StatsActions {
  initStats: (deckId: string, totalCards: number) => void
  recordCorrect: (deckId: string, mode: StudyMode) => void
  recordWrong: (deckId: string) => void
  updateStreak: (deckId: string) => void
  updateMasteredCount: (deckId: string, count: number) => void
}

function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const useStatsStore = create<StatsState & StatsActions>()(
  persist(
    (set, get) => ({
      stats: {},

      initStats: (deckId, totalCards) => {
        const existing = get().stats[deckId]
        if (existing) return
        set((state) => ({
          stats: {
            ...state.stats,
            [deckId]: {
              deckId,
              totalCards,
              cardsReviewed: 0,
              correct: 0,
              wrong: 0,
              accuracy: 0,
              mcScore: 0,
              identificationCorrect: 0,
              enumerationCompleted: 0,
              lastStudied: '',
              studyStreak: 0,
              masteredCount: 0,
              dailyCounts: {},
            },
          },
        }))
      },

      recordCorrect: (deckId, mode) => {
        const today = getTodayStr()
        set((state) => {
          const s = state.stats[deckId]
          if (!s) return state
          const updated: DeckStats = {
            ...s,
            correct: s.correct + 1,
            cardsReviewed: s.cardsReviewed + 1,
            mcScore: mode === 'mc' ? s.mcScore : s.mcScore,
            identificationCorrect: mode === 'identification' ? s.identificationCorrect + 1 : s.identificationCorrect,
            dailyCounts: {
              ...s.dailyCounts,
              [today]: (s.dailyCounts[today] ?? 0) + 1,
            },
          }
          return { stats: { ...state.stats, [deckId]: updated } }
        })
        get().updateStreak(deckId)
      },

      recordWrong: (deckId) => {
        const today = getTodayStr()
        set((state) => {
          const s = state.stats[deckId]
          if (!s) return state
          const updated: DeckStats = {
            ...s,
            wrong: s.wrong + 1,
            cardsReviewed: s.cardsReviewed + 1,
            dailyCounts: {
              ...s.dailyCounts,
              [today]: (s.dailyCounts[today] ?? 0) + 1,
            },
          }
          return { stats: { ...state.stats, [deckId]: updated } }
        })
      },

      updateStreak: (deckId) => {
        set((state) => {
          const s = state.stats[deckId]
          if (!s) return state
          const today = new Date()
          const todayStr = getDateStr(today)
          const yesterday = new Date(today)
          yesterday.setDate(yesterday.getDate() - 1)
          const yesterdayStr = getDateStr(yesterday)

          let newStreak = s.studyStreak
          const lastStudiedDate = s.lastStudied ? s.lastStudied.split('T')[0] : ''

          if (lastStudiedDate === todayStr) {
            // no change
          } else if (lastStudiedDate === yesterdayStr) {
            newStreak = s.studyStreak + 1
          } else if (lastStudiedDate === '') {
            newStreak = 1
          } else {
            newStreak = 1
          }

          const updated: DeckStats = {
            ...s,
            studyStreak: newStreak,
            lastStudied: today.toISOString(),
          }
          return { stats: { ...state.stats, [deckId]: updated } }
        })
      },

      updateMasteredCount: (deckId, count) => {
        set((state) => {
          const s = state.stats[deckId]
          if (!s) return state
          const accuracy = computeAccuracy(s.correct, s.wrong)
          const updated: DeckStats = {
            ...s,
            masteredCount: count,
            accuracy,
          }
          return { stats: { ...state.stats, [deckId]: updated } }
        })
      },
    }),
    {
      name: STATS_PERSIST_KEY,
    }
  )
)
