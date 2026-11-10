'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Layers, List } from 'lucide-react'
import { getCardsByDeck, getCardsForReview } from '@/db/cardRepository'
import { useFlashcardSession } from '@/hooks/useFlashcardSession'
import { shuffleSeeded } from '@/lib/shuffleSeeded'
import StudyHeader, { HeaderIconButton } from '@/components/StudyHeader'
import FlashcardDeck from '@/features/flashcards/FlashcardDeck'
import FlashcardControls from '@/features/flashcards/FlashcardControls'
import SessionEndCard from '@/features/flashcards/SessionEndCard'
import FlashcardListView from '@/features/flashcards/FlashcardListView'
import type { Card } from '@/lib/zodSchemas'
import { safeNavigate } from '@/lib/offlineNavigation'
import { soundEngine } from '@/utils/soundEngine'

function uniqueByAnswer(cards: Card[]): Card[] {
  const seen = new Set<string>()
  const kept: Card[] = []
  for (const card of cards) {
    const key = (card.back ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
    if (!key) {
      kept.push(card)
      continue
    }
    if (seen.has(key)) continue
    seen.add(key)
    kept.push(card)
  }
  return kept
}

export default function FlashcardsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const rawDeckId = params?.deckId as string
  const deckId =
    rawDeckId && rawDeckId !== '_offline'
      ? rawDeckId
      : typeof window !== 'undefined'
        ? window.location.pathname.split('/study/')[1]?.split('/')[0]?.split('?')[0] || ''
        : ''

  const modeReview = searchParams.get('mode') === 'review'

  const [baseCards, setBaseCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'stack' | 'list'>('stack')
  const [randomMode, setRandomMode] = useState(false)
  const [shuffleSeed, setShuffleSeed] = useState(1)

  useEffect(() => {
    const load = async () => {
      if (!deckId) {
        setLoading(false)
        return
      }

      const isTableContent = (c: Card) =>
        /&\[\s*table\s*:/i.test(c.front || '') ||
        /&\[\s*table\s*:/i.test(c.back || '') ||
        /(?:^|\n)\|.+?\|.+?\|(?:\n|$)/.test(c.front || '') ||
        /(?:^|\n)\|.+?\|.+?\|(?:\n|$)/.test(c.back || '')

      try {
        const allCards = (await getCardsByDeck(deckId)).filter((c) => {
          const t = ((c.type as string) || '').toLowerCase()
          return t !== 'tf' && t !== 'true_false' && t !== 'keyword' && !isTableContent(c)
        })
        if (allCards.length === 0) {
          setLoading(false)
          return
        }
        if (modeReview) {
          const dueCards = await getCardsForReview(deckId, new Date())
          const dueFiltered = dueCards.filter((c) => {
            const t = ((c.type as string) || '').toLowerCase()
            return t !== 'tf' && t !== 'true_false' && t !== 'keyword' && !isTableContent(c)
          })
          setBaseCards(uniqueByAnswer(dueFiltered.length > 0 ? dueFiltered : allCards))
        } else {
          setBaseCards(uniqueByAnswer(allCards))
        }
      } catch (err) {
        console.error('Failed to load flashcards:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [deckId, modeReview])

  const cards = useMemo(
    () => (randomMode ? shuffleSeeded(baseCards, shuffleSeed) : baseCards),
    [baseCards, randomMode, shuffleSeed]
  )

  const session = useFlashcardSession(deckId, cards)

  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [exitReset, setExitReset] = useState(false)
  const historyStack = useRef<number[]>([])

  const pushHistory = useCallback((idx: number) => {
    historyStack.current = [...historyStack.current, idx]
  }, [])

  const handleSwipeRight = useCallback(() => {
    soundEngine.playBrush(0.5)
    pushHistory(session.cardIndex)
    session.handleNext()
  }, [session, pushHistory])

  const handleSwipeLeft = useCallback(() => {
    if (historyStack.current.length === 0) return
    soundEngine.playBrush(0.5)
    historyStack.current = historyStack.current.slice(0, -1)
    session.handlePrev()
  }, [session])

  const flyOut = useCallback((x: number, y: number, action: () => void) => {
    soundEngine.playBrush(0.5)
    setIsExiting(true)
    setDragX(x)
    setDragY(y)
    action()
    setTimeout(() => {
      setExitReset(true)
      setIsExiting(false)
      setDragX(0)
      setDragY(0)
      setTimeout(() => setExitReset(false), 100)
    }, 330)
  }, [])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setIsDragging(false)
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    e.preventDefault()
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > 8) setIsDragging(true)
    const dampX = dx * 0.4
    const dampY = dy * 0.4
    setDragX(dx < 0 && historyStack.current.length === 0 ? 0 : dampX)
    setDragY(dampY)
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const dy = e.changedTouches[0].clientY - touchStartY.current
      setIsDragging(false)
      touchStartX.current = null
      touchStartY.current = null

      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      const threshold = 60

      const reset = () => {
        setDragX(0)
        setDragY(0)
      }

      if (absDx >= absDy) {
        if (absDx > threshold) {
          if (dx > 0) {
            if (!session.isAnimating) {
              flyOut(window.innerWidth * 1.05, 0, () => handleSwipeRight())
            } else {
              reset()
            }
          } else if (historyStack.current.length > 0 && !session.isAnimating) {
            flyOut(-window.innerWidth * 1.05, 0, () => handleSwipeLeft())
          } else {
            reset()
          }
        } else {
          reset()
        }
      } else if (absDy > threshold) {
        if (session.isFlipped && !session.isAnimating) {
          if (dy < 0) {
            pushHistory(session.cardIndex)
            flyOut(0, -window.innerHeight * 1.05, () => session.handleKnow())
          } else {
            pushHistory(session.cardIndex)
            flyOut(0, window.innerHeight * 1.05, () => session.handleDontKnow())
          }
        } else {
          reset()
        }
      } else {
        reset()
      }
    },
    [handleSwipeLeft, handleSwipeRight, pushHistory, session, flyOut]
  )

  const handleBack = useCallback(() => {
    soundEngine.play('thocky')
    session.handleEndSession()
    safeNavigate(router, '/study/' + deckId)
  }, [session, router, deckId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        session.handleFlip()
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        session.handleKnow()
      }
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        session.handleDontKnow()
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        session.handlePrev()
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        session.handleNext()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        handleBack()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [session, handleBack])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0c14] flex items-center justify-center">
        <div className="animate-pulse text-[#8e92a8] font-bold">Loading cards...</div>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-[#0b0c14] flex flex-col items-center justify-center gap-4">
        <p className="text-[#8e92a8] font-semibold">No cards in this deck</p>
        <button
          onClick={() => safeNavigate(router, '/study/' + deckId)}
          className="px-5 py-2.5 rounded-full bg-white text-[#0b0c14] text-sm font-bold"
        >
          Back to deck
        </button>
      </div>
    )
  }

  const isFirst = session.cardIndex === 0 && session.batchIndex === 0
  const isLastCardInBatch = session.cardIndex >= session.currentBatch.length - 1
  const isLastOverall = isLastCardInBatch && session.batchIndex >= session.totalBatches - 1
  const swipeHint = dragY < -30 ? 'know' : dragY > 30 ? 'dontknow' : null

  return (
    <div id="flashcardsModal" className="h-[100dvh] overflow-hidden bg-[#0b0c14] flex flex-col justify-between px-4 pt-2 pb-4 max-w-[520px] mx-auto w-full">
      {/* Top Bar: bare Close X + still-learning tally + purple progress bar + know tally + bare List/Shuffle (ui-laws 4b) */}
      <StudyHeader
        onClose={handleBack}
        percent={
          session.currentBatch.length > 0
            ? Math.max(8, ((session.cardIndex + 1) / session.currentBatch.length) * 100)
            : 25
        }
        unknownCount={viewMode === 'stack' ? session.cycleUnknownIds.length : undefined}
        knownCount={viewMode === 'stack' ? session.cycleKnownIds.length : undefined}
        rightSlot={
          <>
            <HeaderIconButton
              onClick={() => setViewMode(viewMode === 'stack' ? 'list' : 'stack')}
              title={viewMode === 'stack' ? 'List view' : 'Card view'}
            >
              {viewMode === 'stack' ? <List size={19} /> : <Layers size={19} />}
            </HeaderIconButton>
            <HeaderIconButton
              onClick={() => {
                if (randomMode) {
                  setRandomMode(false)
                } else {
                  setShuffleSeed((Date.now() % 2147483646) + 1)
                  setRandomMode(true)
                }
              }}
              active={randomMode}
              title={randomMode ? 'Disable shuffle' : 'Shuffle cards'}
            >
              <svg className="w-[19px] h-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
              </svg>
            </HeaderIconButton>
          </>
        }
      />

      {viewMode === 'list' ? (
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <FlashcardListView
            cards={cards}
            onCardDeleted={(deletedId) => setBaseCards((prev) => prev.filter((c) => c.id !== deletedId))}
          />
        </div>
      ) : (
        <>
          {/* Center Interactive 3D Flashcard Stack */}
          <div
            className="flex-1 overflow-hidden flex items-center justify-center my-2 px-1 relative"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{ touchAction: 'none' }}
          >
            {session.showSessionEnd ? (
              <SessionEndCard
                knownCount={session.cycleKnownIds.length}
                unknownCount={session.cycleUnknownIds.length}
                totalCards={cards.length}
                deckId={deckId}
                cycleNumber={session.cycleNumber}
                hasMoreBatches={session.batchIndex < session.totalBatches - 1}
                onNextBatch={session.handleNextBatch}
                onResetCycle={session.handleResetCycle}
              />
            ) : session.currentCard ? (
              <div
                key={session.currentCard.id}
                className="w-full h-full flex items-center justify-center"
                style={{
                  transform: `translateX(${dragX}px) translateY(${dragY}px) rotate(${dragX * 0.04}deg) scale(${isDragging ? 1.02 : 1})`,
                  transition: exitReset
                    ? 'none'
                    : isExiting
                      ? 'transform 0.32s cubic-bezier(0.33, 0.6, 0.44, 1)'
                      : dragX === 0 && dragY === 0
                        ? 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)'
                        : 'none',
                  willChange: 'transform',
                }}
              >
                <FlashcardDeck
                  key={session.currentCard.id}
                  card={session.currentCard}
                  cardIndex={session.cardIndex}
                  totalInBatch={session.currentBatch.length}
                  isFlipped={session.isFlipped}
                  animationClass={isExiting ? 'none' : session.animationClass}
                  onFlip={session.handleFlip}
                  onVerify={session.handleVerifyAnswer}
                />
              </div>
            ) : null}
          </div>

          {!session.showSessionEnd && (
            <FlashcardControls
              isFlipped={session.isFlipped}
              isFirst={isFirst}
              isLast={isLastOverall}
              isAnimating={session.isAnimating}
              swipeHint={swipeHint}
              knownCount={session.cycleKnownIds.length}
              unknownCount={session.cycleUnknownIds.length}
              onPrev={session.handlePrev}
              onNext={session.handleNext}
              onKnow={session.handleKnow}
              onDontKnow={session.handleDontKnow}
            />
          )}
        </>
      )}
    </div>
  )
}
