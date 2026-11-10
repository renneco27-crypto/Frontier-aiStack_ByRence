'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import { useQuizSession } from '@/hooks/useQuizSession'
import StudyHeader, { HeaderIconButton } from '@/components/StudyHeader'
import TrueFalseCard from '@/features/quiz/TrueFalseCard'
import TrueFalseButtons from '@/features/quiz/TrueFalseButtons'
import ExplanationPanel from '@/features/quiz/ExplanationPanel'
import QuizSummary from '@/features/quiz/QuizSummary'
import type { AnswerState, TrueFalseItem } from '@/lib/zodSchemas'

export default function TrueFalseClient() {
  const params = useParams()
  const router = useRouter()
  const rawDeckId = params?.deckId as string
  const deckId = (rawDeckId && rawDeckId !== '_offline')
    ? rawDeckId
    : (typeof window !== 'undefined' ? window.location.pathname.split('/study/')[1]?.split('/')[0]?.split('?')[0] || '' : '')

  const session = useQuizSession(deckId, 'true_false')

  const [userAnswer, setUserAnswer] = useState<boolean | null>(null)
  const [answerState, setAnswerState] = useState<AnswerState>('unanswered')
  const [showPanel, setShowPanel] = useState(false)

  const loading = session.questions.length === 0

  const handleAnswer = useCallback(
    (userBool: boolean) => {
      if (answerState !== 'unanswered') return
      setUserAnswer(userBool)

      const currentItem = session.currentQuestion as TrueFalseItem | null
      const correctAnswer = currentItem?.correct ?? true
      const isCorrect = userBool === correctAnswer

      setAnswerState(isCorrect ? 'correct' : 'wrong')
      setShowPanel(true)
      session.handleAnswer(userBool, isCorrect)
    },
    [answerState, session]
  )

  const handleNext = useCallback(() => {
    setShowPanel(false)
    setUserAnswer(null)
    setAnswerState('unanswered')
    session.handleNext()
  }, [session])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (session.showSummary) return
      if (e.key === 't' || e.key === 'T' || e.key === 'ArrowUp') {
        handleAnswer(true)
      }
      if (e.key === 'f' || e.key === 'F' || e.key === 'ArrowDown') {
        handleAnswer(false)
      }
      if (e.key === 'Enter' && showPanel) {
        handleNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [session.showSummary, handleAnswer, handleNext, showPanel])

  if (loading) {
    return (
      <div className="h-[100dvh] bg-[#0b0c14] flex flex-col justify-between px-4 pt-2 pb-6 max-w-[520px] mx-auto w-full">
        <StudyHeader onClose={() => router.push('/study/' + deckId)} percent={10} />
        <div className="rounded-[28px] bg-[#1b0e3e] border-2 border-[#2f1e5e] p-6 flex-1 my-3 animate-pulse" />
        <div className="flex gap-3 h-20">
          <div className="flex-1 rounded-[18px] bg-[#102e22]/40 border-2 border-[#1ed760]/30 animate-pulse" />
          <div className="flex-1 rounded-[18px] bg-[#381622]/40 border-2 border-[#ff5252]/30 animate-pulse" />
        </div>
      </div>
    )
  }

  if (session.questions.length === 0) {
    return (
      <div className="h-[100dvh] bg-[#0b0c14] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-[#8e92a8] text-[15px] font-semibold">No true/false questions in this deck</p>
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
          mode="True / False"
          deckId={deckId}
          onRetry={session.handleRestart}
        />
      </div>
    )
  }

  const currentItem = session.currentQuestion as TrueFalseItem | null
  const displayStatement = currentItem?.statement ?? ''
  const correctAnswer = currentItem?.correct ?? true
  const percent = session.questions.length > 0
    ? Math.max(8, ((session.currentIndex + 1) / session.questions.length) * 100)
    : 25

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#0b0c14] flex flex-col justify-between px-4 pt-2 pb-6 max-w-[520px] mx-auto w-full select-none">
      {/* Gold Standard Header: bare close + wrong tally + purple progress bar + correct tally + bare restart */}
      <StudyHeader
        onClose={() => router.push('/study/' + deckId)}
        closeIcon="close"
        percent={percent}
        unknownCount={session.wrong}
        knownCount={session.correct}
        rightSlot={
          <HeaderIconButton
            onClick={() => session.handleRestart()}
            title="Restart Session"
          >
            <RotateCcw size={18} />
          </HeaderIconButton>
        }
      />

      {/* Main Question Card & Buttons */}
      <div className="flex-1 flex flex-col justify-between my-2 gap-4 min-h-0">
        <TrueFalseCard
          statement={displayStatement}
          chapter={currentItem?.chapter ?? ''}
          subject={currentItem?.subject ?? ''}
        />

        <TrueFalseButtons
          answerState={answerState}
          userAnswer={userAnswer}
          correctAnswer={correctAnswer}
          onAnswer={handleAnswer}
        />
      </div>

      {/* High-Contrast Readable Explanation Sheet */}
      {showPanel && currentItem && (
        <ExplanationPanel
          isTrue={correctAnswer}
          statement={currentItem.statement}
          explanation={currentItem.explanation}
          userWasCorrect={answerState === 'correct'}
          onNext={handleNext}
        />
      )}
    </div>
  )
}
