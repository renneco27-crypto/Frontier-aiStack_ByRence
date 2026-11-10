'use client'

import { useState } from 'react'
import { Search, Eye, EyeOff, Trash2, CheckSquare, Square, AlertTriangle, Volume2, VolumeX } from 'lucide-react'
import { deleteCard, bulkDeleteCards } from '@/db/cardRepository'
import { useToastStore } from '@/store/toastStore'
import MathFormattedText from '@/components/MathFormattedText'
import { useTTS } from '@/hooks/useTTS'
import type { Card } from '@/lib/zodSchemas'

interface FlashcardListViewProps {
  cards: Card[]
  onCardDeleted?: (cardId: string) => void
}

export default function FlashcardListView({ cards: initialCards, onCardDeleted }: FlashcardListViewProps) {
  const addToast = useToastStore((s) => s.addToast)
  const { status, currentItemIndex, startQueue, speakSingle, stop } = useTTS()
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [search, setSearch] = useState('')
  const [hideAnswers, setHideAnswers] = useState(false)
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    cardIds: string[]
    description: string
  } | null>(null)

  const toggleSelectCard = (cardId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

  const toggleSelectAll = (filteredCards: Card[]) => {
    const allFilteredIds = filteredCards.map((c) => c.id)
    const allSelected = allFilteredIds.every((id) => selectedIds.has(id))

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        allFilteredIds.forEach((id) => next.delete(id))
      } else {
        allFilteredIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const promptDeleteSingle = (card: Card) => {
    setConfirmModal({
      isOpen: true,
      cardIds: [card.id],
      description: `"${card.front.length > 50 ? card.front.slice(0, 50) + '...' : card.front}"`,
    })
  }

  const promptDeleteBulk = () => {
    if (selectedIds.size === 0) return
    setConfirmModal({
      isOpen: true,
      cardIds: Array.from(selectedIds),
      description: `${selectedIds.size} selected card${selectedIds.size !== 1 ? 's' : ''}`,
    })
  }

  const executeDelete = async () => {
    if (!confirmModal || confirmModal.cardIds.length === 0) return
    const ids = confirmModal.cardIds
    try {
      if (ids.length === 1) {
        await deleteCard(ids[0])
      } else {
        await bulkDeleteCards(ids)
      }
      setCards((prev) => prev.filter((c) => !ids.includes(c.id)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
      addToast(
        ids.length === 1 ? 'Card deleted' : `${ids.length} cards deleted`,
        'success'
      )
      if (onCardDeleted) {
        ids.forEach((id) => onCardDeleted(id))
      }
      setConfirmModal(null)
    } catch {
      addToast('Failed to delete card(s)', 'error')
    }
  }

  const toggleAnswer = (id: string) => {
    setRevealedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = cards.filter(c =>
    !search ||
    c.front.toLowerCase().includes(search.toLowerCase()) ||
    c.back.toLowerCase().includes(search.toLowerCase()) ||
    c.chapter.toLowerCase().includes(search.toLowerCase())
  )

  // Group by chapter
  const grouped = filtered.reduce<Record<string, Card[]>>((acc, card) => {
    const ch = card.chapter || 'General'
    if (!acc[ch]) acc[ch] = []
    acc[ch].push(card)
    return acc
  }, {})

  const chapters = Object.keys(grouped)

  const handleToggleTTS = () => {
    if (status !== 'idle') {
      stop()
      return
    }
    const queueItems = filtered.map((c) => ({
      id: c.id,
      title: c.chapter ? `${c.chapter}.` : undefined,
      frontText: `Question: ${c.front}`,
      backText: `Answer: ${c.back}`,
    }))
    startQueue(queueItems, 0)
  }

  const handleSpeakCard = (e: React.MouseEvent, card: Card) => {
    e.stopPropagation()
    speakSingle(`Question: ${card.front}. Answer: ${card.back}.`)
  }

  return (
    <div className="flex-1 overflow-auto flex flex-col w-full relative">
      {/* Search & Bulk Action Bar */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/50  sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-1.5 sm:gap-2">
          <div className="relative flex-1 min-w-[120px]">
            <Search size={14} className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cards…"
              className="w-full pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs sm:text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          {filtered.length > 0 && (
            <button
              onClick={handleToggleTTS}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-medium rounded-xl border transition-colors shrink-0 ${
                status !== 'idle'
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-md animate-pulse'
                  : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-accent)] hover:bg-[var(--color-surface)]'
              }`}
              title={status !== 'idle' ? 'Stop listening' : 'Listen to all cards read aloud sentence by sentence'}
            >
              {status !== 'idle' ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span className="hidden xs:inline">{status !== 'idle' ? 'Stop Audio' : 'Listen All'}</span>
            </button>
          )}

          {filtered.length > 0 && (
            <button
              onClick={() => toggleSelectAll(filtered)}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-medium rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors shrink-0"
              title="Select / Deselect all visible cards"
            >
              <CheckSquare size={14} />
              <span className="hidden sm:inline">Select All</span>
            </button>
          )}

          {selectedIds.size > 0 && (
            <button
              onClick={promptDeleteBulk}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-medium rounded-xl bg-[var(--color-dontknow)] text-white hover:opacity-90 transition-opacity shrink-0 shadow-sm"
            >
              <Trash2 size={14} />
              <span className="text-[11px] sm:text-xs">Delete ({selectedIds.size})</span>
            </button>
          )}

          <button
            onClick={() => {
              setHideAnswers(!hideAnswers)
              setRevealedIds(new Set())
            }}
            className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-medium rounded-xl border transition-colors shrink-0 ${
              hideAnswers
                ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'
            }`}
            title="Toggle hide answers to test your recall"
          >
            {hideAnswers ? <EyeOff size={14} /> : <Eye size={14} />}
            <span className="hidden md:inline">{hideAnswers ? 'Answers Hidden' : 'Hide Answers'}</span>
          </button>
        </div>
      </div>

      {/* Cards List */}
      <div className="flex-1 overflow-auto px-4 pb-24 pt-4 max-w-2xl mx-auto w-full">
        {chapters.map(chapter => (
          <div key={chapter} className="mb-6">
            {chapters.length > 1 && (
              <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-3 px-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                {chapter}
              </h3>
            )}
            <div className="flex flex-col gap-3">
              {grouped[chapter].map((card, i) => {
                const isHidden = hideAnswers && !revealedIds.has(card.id)
                const isSelected = selectedIds.has(card.id)
                const isCurrentlyPlaying = status !== 'idle' && filtered[currentItemIndex]?.id === card.id

                return (
                  <div
                    key={card.id}
                    className={`bg-[#151722] rounded-2xl border overflow-hidden shadow-sm transition-all ${
                      isCurrentlyPlaying
                        ? 'border-[var(--color-know)] ring-2 ring-[var(--color-know)]/40 shadow-lg'
                        : isSelected
                          ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]'
                          : 'border-[var(--color-border)] hover:border-[var(--color-border-neon)]'
                    }`}
                  >
                    {/* Question / front */}
                    <div className="p-4 bg-[var(--color-surface)]">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => toggleSelectCard(card.id)}
                            className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors p-0.5"
                            title="Select card"
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-[var(--color-accent)]" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
                            #{i + 1} • {card.type}
                          </span>
                          {card.lesson && (
                            <span className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[150px]">
                              {card.lesson}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleSpeakCard(e, card)}
                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors"
                            title="Listen to this card"
                          >
                            <Volume2 size={15} />
                          </button>
                          <button
                            onClick={() => promptDeleteSingle(card)}
                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-dontknow)] hover:bg-[var(--color-dontknow)]/10 transition-colors"
                            title="Delete card"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <div className="font-display text-base sm:text-lg text-[var(--color-text-primary)] leading-snug">
                        <MathFormattedText text={card.front} />
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-[var(--color-border)]" />

                    {/* Answer / back */}
                    <div
                      onClick={() => isHidden && toggleAnswer(card.id)}
                      className={`p-4 bg-[var(--color-surface-2)] transition-colors ${
                        isHidden ? 'cursor-pointer hover:bg-[var(--color-surface-3)]' : ''
                      }`}
                    >
                      <p className="text-[11px] uppercase tracking-wider text-[var(--color-know)] mb-1 font-semibold flex items-center justify-between">
                        <span>Answer</span>
                        {isHidden && (
                          <span className="text-xs text-[var(--color-accent)] font-normal">
                            Click to reveal
                          </span>
                        )}
                      </p>

                      {isHidden ? (
                        <p className="text-sm text-transparent select-none blur-[6px]">
                          {card.back}
                        </p>
                      ) : (
                        <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line font-medium">
                          <MathFormattedText text={card.back} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-[var(--color-text-muted)] text-sm">
            No cards found matching "{search}"
          </div>
        )}
      </div>

      {/* In-app HTML Confirmation Modal for Delete */}
      {confirmModal?.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70  animate-in fade-in duration-150"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="bg-[#151722] rounded-2xl border border-[var(--color-border)] w-full max-w-sm p-6  shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-[var(--color-dontknow)]">
              <div className="p-2.5 rounded-xl bg-[var(--color-dontknow)]/15">
                <AlertTriangle size={22} />
              </div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                Delete {confirmModal.cardIds.length === 1 ? 'Card' : `${confirmModal.cardIds.length} Cards`}?
              </h3>
            </div>

            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-[var(--color-text-primary)]">{confirmModal.description}</span>? This action cannot be undone.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-dontknow)] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
