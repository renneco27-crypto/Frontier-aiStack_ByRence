'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { RotateCcw, Volume2 } from 'lucide-react'
import { useQuizSession } from '@/hooks/useQuizSession'
import { getDeck } from '@/db/deckRepository'
import { getCardsByDeck } from '@/db/cardRepository'
import { evaluateEnumerationSet, isEnumerationOrdered } from '@/lib/answerEvaluator'
import { shuffleSeeded } from '@/lib/shuffleSeeded'
import StudyHeader, { HeaderIconButton } from '@/components/StudyHeader'
import QuizSummary from '@/features/quiz/QuizSummary'
import EnumerationCard from '@/features/quiz/EnumerationCard'
import type { EnumerationItem, Card, Deck } from '@/lib/zodSchemas'

export default function EnumerationClient() {
  const params = useParams()
  const router = useRouter()
  const rawDeckId = params?.deckId as string
  const deckId = (rawDeckId && rawDeckId !== '_offline')
    ? rawDeckId
    : (typeof window !== 'undefined' ? window.location.pathname.split('/study/')[1]?.split('/')[0]?.split('?')[0] || '' : '')

  const session = useQuizSession(deckId, 'enumeration')
  const [userAnswers, setUserAnswers] = useState<string[]>([])
  const [deck, setDeck] = useState<Deck | null>(null)
  const [deckCards, setDeckCards] = useState<Card[]>([])
  const [autoVoice, setAutoVoice] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('studyup_enumeration_voice_explanations')
      if (saved === 'true') setAutoVoice(true)
    } catch {}
  }, [])

  const toggleAutoVoice = useCallback(() => {
    setAutoVoice((prev) => {
      const next = !prev
      try {
        localStorage.setItem('studyup_enumeration_voice_explanations', String(next))
      } catch {}
      return next
    })
  }, [])

  useEffect(() => {
    if (deckId) {
      Promise.all([getDeck(deckId), getCardsByDeck(deckId)]).then(([d, cards]) => {
        setDeck(d ?? null)
        setDeckCards(cards ?? [])
      })
    }
  }, [deckId])

  const loading = session.questions.length === 0
  const currentItem = session.currentQuestion as EnumerationItem | null

  const shuffledItems = useMemo(() => {
    if (!currentItem) return []
    if (isEnumerationOrdered(currentItem.topic)) {
      return [...currentItem.items]
    }
    return shuffleSeeded([...currentItem.items], session.currentIndex)
  }, [currentItem, session.currentIndex])

  useEffect(() => {
    if (shuffledItems.length > 0) {
      setUserAnswers(new Array(shuffledItems.length).fill(''))
    }
  }, [shuffledItems, session.currentIndex])

  const handleChecked = useCallback(() => {
    if (!currentItem || shuffledItems.length === 0) return
    const { correctCount, wrongCount } = evaluateEnumerationSet(userAnswers, shuffledItems, currentItem.topic)
    const isAllCorrect = wrongCount === 0 && correctCount === shuffledItems.length
    session.handleAnswer(userAnswers.join('; '), isAllCorrect)
  }, [currentItem, shuffledItems, userAnswers, session])

  const handleAdvanceCard = useCallback(() => {
    session.handleNext()
  }, [session])

  const handleAnswerChange = useCallback((index: number, value: string) => {
    setUserAnswers((prev) => {
      const updated = [...prev]
      updated[index] = value
      return updated
    })
  }, [])

  if (loading) {
    return (
      <div className="h-[100dvh] bg-[#0b0c14] flex flex-col justify-between px-4 pt-2 pb-6 max-w-[520px] mx-auto w-full">
        <StudyHeader onClose={() => router.push('/study/' + deckId)} percent={10} />
        <div className="rounded-[28px] bg-[#1b0e3e] border-2 border-[#2f1e5e] p-6 flex-1 my-3 animate-pulse" />
      </div>
    )
  }

  if (session.questions.length === 0) {
    return (
      <div className="h-[100dvh] bg-[#0b0c14] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-[#8e92a8] text-[15px] font-semibold">No enumeration questions in this deck</p>
        <button
          onClick={() => router.push('/study/' + deckId)}
          className="h-12 px-6 rounded-[14px] bg-[#7e57ff] border-2 border-[#9d7eff] shadow-[0px_3px_0px_0px_#4c2fb3] text-white font-extrabold text-[14px] tactile-btn cursor-pointer"
        >
          Back to deck
        </button>
      </div>
    )
  }

  if (session.showSummary) {
    return (
      <div className="min-h-screen bg-[#0b0c14] p-4 flex items-center justify-center">
        <QuizSummary
          correct={session.correct}
          wrong={session.wrong}
          total={session.questions.length}
          mode="Enumeration"
          deckId={deckId}
          onRetry={session.handleRestart}
        />
      </div>
    )
  }

  const percent = session.questions.length > 0
    ? Math.max(8, ((session.currentIndex + 1) / session.questions.length) * 100)
    : 25

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#0b0c14] flex flex-col justify-between px-4 pt-2 pb-4 max-w-[520px] mx-auto w-full select-none">
      <StudyHeader
        onClose={() => router.push('/study/' + deckId)}
        closeIcon="close"
        percent={percent}
        unknownCount={session.wrong}
        knownCount={session.correct}
        rightSlot={
          <div className="flex items-center gap-1">
            <HeaderIconButton
              onClick={toggleAutoVoice}
              title={autoVoice ? 'Voice explanations ON' : 'Voice explanations OFF'}
            >
              <Volume2 size={18} className={autoVoice ? 'text-[#7e57ff]' : 'text-[#8e92a8]'} />
            </HeaderIconButton>
            <HeaderIconButton
              onClick={() => session.handleRestart()}
              title="Restart Session"
            >
              <RotateCcw size={18} />
            </HeaderIconButton>
          </div>
        }
      />

      <EnumerationCard
        topic={currentItem?.topic ?? ''}
        items={shuffledItems}
        userAnswers={userAnswers}
        onCheckAnswers={handleChecked}
        onAdvance={handleAdvanceCard}
        onAnswerChange={handleAnswerChange}
        chapter={currentItem?.chapter ?? ''}
        subject={currentItem?.subject ?? ''}
        deck={deck}
        cards={deckCards}
        autoVoice={autoVoice}
      />
    </div>
  )
}
