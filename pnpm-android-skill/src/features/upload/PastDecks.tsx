'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { getAllDecks, deleteDeck } from '@/db/deckRepository'
import { getCardsByDeck } from '@/db/cardRepository'
import ExportButton from '@/features/export/ExportButton'
import { useStatsStore } from '@/store/statsStore'
import { useUIStore } from '@/store/uiStore'
import { safeNavigate } from '@/lib/offlineNavigation'
import type { Deck } from '@/lib/zodSchemas'
import { soundEngine } from '@/utils/soundEngine'

export default function PastDecks() {
  const router = useRouter()
  const pathname = usePathname()
  const [decks, setDecks] = useState<Deck[]>(() => [])
  const [deckToDelete, setDeckToDelete] = useState<string | null>(null)
  const stats = useStatsStore((s) => s.stats)
  const { selectedDeckId, setSelectedDeckId, openUploadModal } = useUIStore()

  useEffect(() => {
    getAllDecks().then((all) => {
      setDecks(all)
      if (all.length > 0 && (!selectedDeckId || !all.some((d) => d.id === selectedDeckId))) {
        setSelectedDeckId(all[0].id)
      }
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
      }
    })
  }, [pathname, selectedDeckId, setSelectedDeckId])

  const handleDelete = (e: React.MouseEvent, deckId: string) => {
    e.stopPropagation()
    soundEngine.play('thocky')
    setDeckToDelete(deckId)
  }

  const confirmDelete = async (e: React.MouseEvent, deckId: string) => {
    e.stopPropagation()
    soundEngine.play('thocky')
    setDeckToDelete(null)

    setDecks((prev) => prev.filter((d) => d.id !== deckId))

    try {
      await deleteDeck(deckId)
    } catch (err) {
      console.error('Error deleting deck:', err)
      const allDecks = await getAllDecks()
      setDecks(allDecks)
      return
    }

    const allDecks = await getAllDecks()
    setDecks(allDecks)
    if (selectedDeckId === deckId) {
      setSelectedDeckId(allDecks[0]?.id ?? null)
    }
  }

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    soundEngine.play('thocky')
    setDeckToDelete(null)
  }

  const [cardData, setCardData] = useState<Record<string, { total: number; mastered: number; due: number }>>({})

  useEffect(() => {
    const fetchCounts = async () => {
      const data: Record<string, { total: number; mastered: number; due: number }> = {}
      for (const deck of decks) {
        const cards = await getCardsByDeck(deck.id)
        const total = cards.length
        const mastered = cards.filter((c) => c.status === 'mastered').length
        const due = Math.max(0, total - mastered)
        data[deck.id] = { total, mastered, due }
      }
      setCardData(data)
    }
    if (decks.length > 0) fetchCounts()
  }, [decks])

  if (decks.length === 0) {
    return (
      <div className="px-2.5 pt-4">
        <div className="mb-4 relative z-20 px-1.5 space-y-3">
          <div>
            <h2 className="text-[20px] font-extrabold text-white tracking-tight leading-tight mb-1">
              No study decks yet
            </h2>
            <p className="text-[13px] text-[#8e92a8] leading-relaxed">
              Upload a document or paste study notes to generate your first deck.
            </p>
          </div>
          <button
            data-slot="button"
            data-variant="default"
            data-size="default"
            onClick={() => {
              soundEngine.play('poppy')
              openUploadModal()
            }}
            className="w-full h-12 px-5 rounded-[16px] border-2 border-[#9333ea] bg-[#9333ea] text-white font-extrabold text-[15px] uppercase tracking-wide shadow-[0px_4px_0px_0px_#6b21a8] hover:opacity-95 tactile-btn flex items-center justify-center gap-2 cursor-pointer"
          >
            Create deck
          </button>
        </div>
      </div>
    )
  }

  const activeDeck = decks.find((d) => d.id === selectedDeckId) || decks[0]
  const activeCd = cardData[activeDeck.id]
  const activeTotal = activeCd?.total ?? 0
  const activeMastered = activeCd?.mastered ?? 0
  const activeDue = activeCd?.due ?? activeTotal
  const activePercent = activeTotal > 0 ? Math.round((activeMastered / activeTotal) * 100) : 0

  return (
    <div className="px-2.5 pt-3">
      {/* Active Study Deck: UP NEXT (1:1 Reference) */}
      <div className="mb-7 relative z-20 px-1.5">
        <span className="block text-[11px] font-extrabold text-[#A78BFA] tracking-wider uppercase mb-1">UP NEXT</span>
        <h2
          id="homeActiveDeckTitle"
          onClick={() => {
            if (!activeDeck?.id) return
            soundEngine.play('thocky')
            safeNavigate(router, '/study/' + activeDeck.id)
          }}
          className="text-[22px] font-extrabold text-white tracking-tight leading-tight mb-2 truncate cursor-pointer hover:text-[#C4B5FD] transition"
        >
          {activeDeck.title}
        </h2>

        <div className="flex items-center justify-between text-[12.5px] font-semibold text-white/80 mb-2">
          <span id="homeActiveCardCount">{activeDue} cards due</span>
          <span className="text-[#C4B5FD] font-bold">{activePercent}% mastered</span>
        </div>

        <div className="w-full h-1.5 rounded-full bg-white/20 overflow-hidden mb-3.5">
          <div className="h-full rounded-full bg-[#7C3AED] transition-all duration-300" style={{ width: `${activePercent}%` }} />
        </div>

        <button
          data-slot="button"
          data-variant="default"
          data-size="default"
          onClick={() => {
            if (!activeDeck?.id) return
            soundEngine.play('thocky')
            safeNavigate(router, '/study/' + activeDeck.id)
          }}
          className="w-full h-12 px-5 rounded-[16px] border-2 border-[#9333ea] bg-[#9333ea] text-white font-extrabold text-[15px] uppercase tracking-wide shadow-[0px_4px_0px_0px_#6b21a8] hover:opacity-95 tactile-btn flex items-center justify-center gap-2 cursor-pointer"
        >
          Open Deck
        </button>
      </div>

      {/* "Choose Deck to Study" Section with Top & Bottom Fade */}
      <div id="deckSelectSection" className="w-full mt-2 mb-0 relative z-20">
        <div className="flex items-center justify-between px-2 mb-3.5">
          <span className="text-[14px] font-extrabold text-white tracking-tight">Choose Deck to Study</span>
        </div>

        <div className="cards-fade-scroll-container space-y-3.5 w-full">
          {decks.map((deck) => {
            const cd = cardData[deck.id]
            const totalCards = cd?.total ?? 0
            const masteredCount = cd?.mastered ?? 0
            const dueCount = cd?.due ?? totalCards
            const progress = totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0
            const isSelected = deck.id === activeDeck.id
            const estMins = Math.max(5, Math.ceil(totalCards * 1.2))
            const estText = estMins >= 60 ? `${(estMins / 60).toFixed(1).replace(/\.0$/, '')} hours to review` : `${estMins} mins to review`
            const deckStats = stats[deck.id]
            const sheetsCount = Math.max(1, Math.ceil(totalCards / 10))

            return (
              <article
                key={deck.id}
                onClick={() => {
                  soundEngine.play('thocky')
                  setSelectedDeckId(deck.id)
                  safeNavigate(router, '/study/' + deck.id)
                }}
                className="syllabus-card w-full cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <div className="flex items-center gap-1.5 text-[#94A3B8] text-[12px] font-medium min-w-0">
                    <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="12 7 12 12 15 14" />
                    </svg>
                    <span className="truncate">{estText}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isSelected && (
                      <span
                        data-slot="badge"
                        data-variant="default"
                        onClick={() => safeNavigate(router, '/study/' + deck.id)}
                        className="deck-check h-6 gap-1 rounded-full border-2 border-[#9333ea]/40 bg-[#9333ea]/15 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[#c084fc] inline-flex items-center cursor-pointer"
                      >
                        Active Deck ✓
                      </span>
                    )}
                    <ExportButton deckId={deck.id} deckTitle={deck.title} variant="icon" />
                    {deckToDelete === deck.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          data-slot="button"
                          data-variant="destructive"
                          data-size="xs"
                          onClick={(e) => confirmDelete(e, deck.id)}
                          className="h-7 px-2.5 rounded-[10px] border-2 border-[#ef4444] bg-[#ef4444] text-white font-extrabold text-[11px] uppercase tracking-wide shadow-[0px_2px_0px_0px_#991b1b] tactile-btn cursor-pointer"
                        >
                          Delete
                        </button>
                        <button
                          data-slot="button"
                          data-variant="secondary"
                          data-size="xs"
                          onClick={cancelDelete}
                          className="h-7 px-2.5 rounded-[10px] border-2 border-[#222536] bg-[#1c1f2e] text-[#8e92a8] font-extrabold text-[11px] uppercase tracking-wide shadow-[0px_2px_0px_0px_#121420] tactile-btn cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        data-slot="button"
                        data-variant="secondary"
                        data-size="icon-xs"
                        onClick={(e) => handleDelete(e, deck.id)}
                        className="w-7 h-7 rounded-[10px] border-2 border-[#222536] bg-[#1c1f2e] text-[#8e92a8] hover:text-[#ef4444] hover:border-[#ef4444]/50 flex items-center justify-center shadow-[0px_2px_0px_0px_#121420] tactile-btn cursor-pointer"
                        aria-label="Delete deck"
                        title="Delete deck"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="font-display text-[15px] font-extrabold text-white tracking-tight mb-3 break-words">
                  {deck.title}
                </h3>

                <div className="flex items-center justify-between text-[12.5px] text-[#94A3B8] pr-2">
                  <span>
                    <strong className="font-bold text-white">{dueCount}</strong> cards due
                  </span>
                  <span>
                    <strong className="font-bold text-white">{deckStats?.studyStreak ? `${deckStats.studyStreak}d` : sheetsCount}</strong>{' '}
                    {deckStats?.studyStreak ? 'Streak' : 'Sheets'}
                  </span>
                  <span>
                    <strong className="font-bold text-white">{progress}%</strong> mastered
                  </span>
                </div>

                <div className="progress-stack">
                  <div className="progress-fill-indigo" style={{ width: `${progress}%` }} />
                  <div className="progress-track-slate" />
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
