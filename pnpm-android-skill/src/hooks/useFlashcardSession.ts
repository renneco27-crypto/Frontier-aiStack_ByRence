'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { updateCard } from '@/db/cardRepository'
import { saveSession, loadSession, clearSession } from '@/db/sessionRepository'
import { useSessionStore } from '@/store/sessionStore'
import { useStatsStore } from '@/store/statsStore'
import { buildCycle, getResumePosition } from '@/features/flashcards/FlashcardCycleManager'
import { appendCycleResult } from '@/features/flashcards/cycleHistory'
import { MASTERY_MAX, MASTERY_THRESHOLD } from '@/lib/constants'
import type { Card } from '@/lib/zodSchemas'
import { evaluateAnswerLocal } from '@/lib/answerEvaluator'
import { soundEngine } from '@/utils/soundEngine'

function deduplicate(
  knownIds: string[],
  unknownIds: string[]
): { knownIds: string[]; unknownIds: string[] } {
  const seen = new Set<string>()
  const dedupedKnown: string[] = []
  const dedupedUnknown: string[] = []

  const knownEntries: { id: string; type: 'known' | 'unknown' }[] = knownIds.map((id) => ({ id, type: 'known' as const }))
  const unknownEntries: { id: string; type: 'known' | 'unknown' }[] = unknownIds.map((id) => ({ id, type: 'unknown' as const }))
  const allAnswers = [...knownEntries, ...unknownEntries]

  for (let i = allAnswers.length - 1; i >= 0; i--) {
    const { id, type } = allAnswers[i]
    if (!seen.has(id)) {
      seen.add(id)
      if (type === 'known') {
        dedupedKnown.push(id)
      } else {
        dedupedUnknown.push(id)
      }
    }
  }

  return { knownIds: dedupedKnown, unknownIds: dedupedUnknown }
}

export function useFlashcardSession(deckId: string, cards: Card[]) {
  const router = useRouter()

  const cycleNumber = useSessionStore((s) => s.cycleNumber)
  const batchIndex = useSessionStore((s) => s.batchIndex)
  const cardIndex = useSessionStore((s) => s.cardIndex)
  const completedCardIds = useSessionStore((s) => s.completedCardIds)
  const isFlipped = useSessionStore((s) => s.isFlipped)
  const setDeckId = useSessionStore((s) => s.setDeckId)
  const setCycleNumber = useSessionStore((s) => s.setCycleNumber)
  const setBatchIndex = useSessionStore((s) => s.setBatchIndex)
  const setCardIndex = useSessionStore((s) => s.setCardIndex)
  const markCardCompleted = useSessionStore((s) => s.markCardCompleted)
  const clearCompletedIds = useSessionStore((s) => s.clearCompletedIds)
  const setFlipped = useSessionStore((s) => s.setFlipped)
  const resetSession = useSessionStore((s) => s.resetSession)

  const recordCorrect = useStatsStore((s) => s.recordCorrect)
  const recordWrong = useStatsStore((s) => s.recordWrong)

  const [cycle, setCycle] = useState<Card[][]>([])
  const [animationClass, setAnimationClass] = useState<'none' | 'slide-right' | 'slide-left' | 'slide-in'>('none')
  const [isAnimating, setIsAnimating] = useState(false)
  const [showSessionEnd, setShowSessionEnd] = useState(false)
  const [cycleKnownIds, setCycleKnownIds] = useState<string[]>([])
  const [cycleUnknownIds, setCycleUnknownIds] = useState<string[]>([])

  useEffect(() => {
    const init = async () => {
      if (cards.length === 0) return

      const existingSession = await loadSession(deckId)
      if (existingSession && existingSession.deckId === deckId) {
        setDeckId(deckId)
        setCycleNumber(existingSession.cycleNumber)
        setBatchIndex(existingSession.batchIndex)
        setCardIndex(existingSession.cardIndex)
        existingSession.completedCardIds.forEach((id) => markCardCompleted(id))
        setFlipped(existingSession.isFlipped)
      } else {
        setDeckId(deckId)
        setCycleNumber(1)
        setBatchIndex(0)
        setCardIndex(0)
        markCardCompleted('__init__')
        setFlipped(false)
      }

      const newCycle = buildCycle(cards, existingSession?.cycleNumber ?? 1)
      setCycle(newCycle)

      const resume = getResumePosition(newCycle, existingSession ?? {
        deckId,
        cycleNumber: 1,
        batchIndex: 0,
        cardIndex: 0,
        completedCardIds: [],
        isFlipped: false,
      })
      setBatchIndex(resume.batchIndex)
      setCardIndex(resume.cardIndex)
      setCycleKnownIds([])
      setCycleUnknownIds([])
    }

    init()
  }, [cards, deckId]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentBatch = cycle[batchIndex] ?? []
  const currentCard = currentBatch[cardIndex] ?? null
  const totalBatches = cycle.length
  const hasAnswers = cycleKnownIds.length > 0 || cycleUnknownIds.length > 0

  const saveSessionState = useCallback(() => {
    saveSession({
      deckId,
      cycleNumber,
      batchIndex,
      cardIndex,
      completedCardIds,
      isFlipped,
    })
  }, [deckId, cycleNumber, batchIndex, cardIndex, completedCardIds, isFlipped])

  const advanceCard = useCallback(() => {
    setFlipped(false)
    if (cardIndex < currentBatch.length - 1) {
      setCardIndex(cardIndex + 1)
      saveSessionState()
    } else if (batchIndex < cycle.length - 1) {
      setBatchIndex(batchIndex + 1)
      setCardIndex(0)
      saveSessionState()
    } else {
      setShowSessionEnd(true)
      appendCycleResult(
        deckId,
        cycleNumber,
        cycleKnownIds,
        cycleUnknownIds
      )
    }
  }, [cardIndex, currentBatch.length, batchIndex, cycle.length, cycleNumber, cycleKnownIds, cycleUnknownIds, deckId, setFlipped, setCardIndex, setBatchIndex, saveSessionState])

  const handleFlip = useCallback(() => {
    if (isAnimating) return
    soundEngine.playBrush(0.5)
    setFlipped(!isFlipped)
  }, [isAnimating, isFlipped, setFlipped])

  const handleKnow = useCallback(async (skipGuard = false) => {
    if (!currentCard) return
    if (!skipGuard && isAnimating) return
    setIsAnimating(true)
    setAnimationClass('slide-right')

    setTimeout(async () => {
      const newMastery = currentCard.mastery <= 0 ? 1 : Math.min(currentCard.mastery + 1, MASTERY_MAX)
      const newStatus = newMastery >= MASTERY_THRESHOLD
        ? 'mastered'
        : newMastery >= 1
          ? 'learning'
          : 'new'

      await updateCard(currentCard.id, {
        know: true,
        mastery: newMastery,
        status: newStatus,
        correctCount: currentCard.correctCount + 1,
        lastReviewed: new Date().toISOString(),
      })

      recordCorrect(deckId, 'flashcard')
      setCycleKnownIds((prev) => [...prev, currentCard.id])
      markCardCompleted(currentCard.id)

      setAnimationClass('slide-in')
      setFlipped(false)
      advanceCard()

      setTimeout(() => {
        setAnimationClass('none')
        setIsAnimating(false)
      }, 250)
    }, 300)
  }, [isAnimating, currentCard, deckId, recordCorrect, markCardCompleted, setFlipped, advanceCard])

  const handleDontKnow = useCallback(async () => {
    if (isAnimating || !currentCard) return
    setIsAnimating(true)
    setAnimationClass('slide-left')

    setTimeout(async () => {
      const newMastery = currentCard.mastery >= 0 ? -1 : currentCard.mastery - 1
      const newStatus = newMastery >= MASTERY_THRESHOLD
        ? 'mastered'
        : newMastery >= 1
          ? 'learning'
          : 'new'

      await updateCard(currentCard.id, {
        know: false,
        mastery: newMastery,
        status: newStatus,
        wrongCount: currentCard.wrongCount + 1,
        lastReviewed: new Date().toISOString(),
      })

      recordWrong(deckId)
      setCycleUnknownIds((prev) => [...prev, currentCard.id])
      markCardCompleted(currentCard.id)

      setAnimationClass('slide-in')
      setFlipped(false)
      advanceCard()

      setTimeout(() => {
        setAnimationClass('none')
        setIsAnimating(false)
      }, 250)
    }, 300)
  }, [isAnimating, currentCard, deckId, recordWrong, markCardCompleted, setFlipped, advanceCard])

  const handleVerifyAnswer = useCallback(async (answer: string) => {
    if (!currentCard || isAnimating) return { correct: false, isEvaluated: false }
    
    const { ratio } = evaluateAnswerLocal(answer, currentCard.back)
    const isCorrect = ratio >= 70
    
    if (isCorrect) {
      setIsAnimating(true)
      setFlipped(true)
      
      setTimeout(() => {
        handleKnow(true)
      }, 1500)
    }
    
    return { correct: isCorrect, isEvaluated: true }
  }, [currentCard, isAnimating, handleKnow, setFlipped])

  const handleNext = useCallback(() => {
    if (isAnimating) return
    if (cardIndex < currentBatch.length - 1) {
      setCardIndex(cardIndex + 1)
      setFlipped(false)
      saveSessionState()
    } else if (batchIndex < cycle.length - 1) {
      setBatchIndex(batchIndex + 1)
      setCardIndex(0)
      setFlipped(false)
      saveSessionState()
    } else {
      setShowSessionEnd(true)
    }
  }, [isAnimating, cardIndex, currentBatch.length, batchIndex, cycle.length, setFlipped, setCardIndex, setBatchIndex, saveSessionState, setShowSessionEnd])

  const handlePrev = useCallback(() => {
    if (isAnimating) return
    if (cardIndex > 0) {
      setCardIndex(cardIndex - 1)
      setFlipped(false)
      saveSessionState()
    } else if (batchIndex > 0) {
      const prevBatch = cycle[batchIndex - 1]
      setBatchIndex(batchIndex - 1)
      setCardIndex(prevBatch.length - 1)
      setFlipped(false)
      saveSessionState()
    }
  }, [isAnimating, cardIndex, batchIndex, cycle, setFlipped, setCardIndex, setBatchIndex, saveSessionState])

  const handleResetCycle = useCallback(() => {
    const newCycleNumber = cycleNumber + 1
    setCycleNumber(newCycleNumber)
    setBatchIndex(0)
    setCardIndex(0)
    clearCompletedIds()
    setCycleKnownIds([])
    setCycleUnknownIds([])
    clearSession(deckId)
    setShowSessionEnd(false)

    const newCycle = buildCycle(cards, newCycleNumber)
    setCycle(newCycle)

    setFlipped(false)
    saveSessionState()
  }, [cycleNumber, deckId, cards, setCycleNumber, setBatchIndex, setCardIndex, clearCompletedIds, setFlipped, saveSessionState])

  const handleNextBatch = useCallback(() => {
    if (batchIndex < cycle.length - 1) {
      setBatchIndex(batchIndex + 1)
      setCardIndex(0)
      setFlipped(false)
      saveSessionState()
    } else {
      handleResetCycle()
    }
  }, [batchIndex, cycle.length, setFlipped, setCardIndex, setBatchIndex, saveSessionState, handleResetCycle])

  const handleEndSession = useCallback(() => {
    if (hasAnswers) {
      const deduped = deduplicate(cycleKnownIds, cycleUnknownIds)
      appendCycleResult(deckId, cycleNumber, deduped.knownIds, deduped.unknownIds)
    }
    clearSession(deckId)
    resetSession()
    router.push('/study/' + deckId)
  }, [hasAnswers, cycleKnownIds, cycleUnknownIds, deckId, cycleNumber, router, resetSession])

  return {
    currentCard,
    currentBatch,
    batchIndex,
    cardIndex,
    totalBatches,
    cycleNumber,
    isFlipped,
    isAnimating,
    showSessionEnd,
    cycleKnownIds,
    cycleUnknownIds,
    animationClass,

    handleFlip,
    handleKnow,
    handleDontKnow,
    handleNext,
    handlePrev,
    handleNextBatch,
    handleResetCycle,
    handleEndSession,
    handleVerifyAnswer,
  }
}
