'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Check, X, RotateCcw } from 'lucide-react'
import { useQuizSession } from '@/hooks/useQuizSession'
import StudyHeader, { HeaderIconButton } from '@/components/StudyHeader'
import QuizSummary from '@/features/quiz/QuizSummary'
import MathFormattedText from '@/components/MathFormattedText'
import { checkIdentificationAnswer } from '@/features/identification/answerChecker'
import { soundEngine } from '@/utils/soundEngine'
import type { IdentificationItem } from '@/lib/zodSchemas'

export default function IdentificationClient() {
  const params = useParams()
  const router = useRouter()
  const rawDeckId = params?.deckId as string
  const deckId = (rawDeckId && rawDeckId !== '_offline')
    ? rawDeckId
    : (typeof window !== 'undefined' ? window.location.pathname.split('/study/')[1]?.split('/')[0]?.split('?')[0] || '' : '')

  const session = useQuizSession(deckId, 'identification')
  const [userAnswer, setUserAnswer] = useState('')
  const [result, setResult] = useState<{ isCorrect: boolean; matchedVariant?: string | null } | null>(null)

  const loading = session.questions.length === 0
  const currentItem = session.currentQuestion as IdentificationItem | null

  const handleCheck = useCallback(() => {
    if (!currentItem || !userAnswer.trim()) return
    const res = checkIdentificationAnswer(userAnswer, currentItem.answer, currentItem.acceptVariants || [])
    setResult(res)
    if (res.isCorrect) {
      soundEngine.play('poppy', 18)
    } else {
      soundEngine.play('thocky', 18)
    }
    session.handleAnswer(userAnswer, res.isCorrect)
  }, [currentItem, userAnswer, session])

  const handleSkip = useCallback(() => {
    soundEngine.play('thocky')
    setResult({ isCorrect: false })
    session.handleAnswer('', false)
  }, [session])

  const handleNext = useCallback(() => {
    soundEngine.play('thocky')
    setUserAnswer('')
    setResult(null)
    session.handleNext()
  }, [session])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (session.showSummary) return
      if (e.key === 'Enter') {
        if (!result) {
          handleCheck()
        } else {
          handleNext()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [session.showSummary, result, handleCheck, handleNext])

  if (loading) {
    return (
      <div className="h-[100dvh] bg-[#0b0c14] flex flex-col justify-between px-4 pt-2 pb-6 max-w-[520px] mx-auto w-full">
        <StudyHeader onClose={() => router.push('/study/' + deckId)} percent={10} />
        <div className="rounded-[28px] bg-[#1b0e3e] border-2 border-[#2f1e5e] p-6 flex-1 my-3 animate-pulse" />
        <div className="h-12 rounded-[16px] bg-[#1a1c29] border-2 border-[#222536] animate-pulse" />
      </div>
    )
  }

  if (session.questions.length === 0) {
    return (
      <div className="h-[100dvh] bg-[#0b0c14] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-[#8e92a8] text-[15px] font-semibold">No identification questions in this deck</p>
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
          mode="Identification"
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
      {/* Header */}
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

      {/* Main Focus: Question Card */}
      <div className="flex-1 flex flex-col justify-between my-2 gap-4 min-h-0">
        <div className="rounded-[28px] bg-[#1b0e3e] border-2 border-[#2f1e5e] p-6 sm:p-8 flex-1 flex flex-col justify-between shadow-2xl relative min-h-[220px]">
          <div className="text-[12px] font-bold uppercase tracking-wider text-[#9d94ba] flex items-center justify-between shrink-0">
            <span className="truncate max-w-[200px]">{currentItem?.chapter || 'Identification'}</span>
            {currentItem?.subject && (
              <span className="text-[#8e92a8] text-[12px] font-semibold">{currentItem.subject}</span>
            )}
          </div>
          <div className="font-display text-[20px] sm:text-[23px] text-center text-white py-6 flex items-center justify-center leading-relaxed flex-1">
            <MathFormattedText text={currentItem?.definition || ''} />
          </div>
          <div className="h-2 shrink-0" />
        </div>

        {/* Input & Actions */}
        {!result ? (
          <div className="flex flex-col gap-3 shrink-0">
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Type your answer..."
              className="h-12 w-full px-4 rounded-[16px] border-2 border-[#222536] bg-[#1a1c29] text-white text-[15px] font-medium placeholder:text-[#8e92a8] focus:outline-none focus:border-[#7e57ff] transition"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCheck}
                disabled={!userAnswer.trim()}
                className="flex-1 h-12 rounded-[14px] bg-[#7e57ff] border-2 border-[#9d7eff] shadow-[0px_3px_0px_0px_#4c2fb3] text-white font-extrabold text-[15px] tactile-btn cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                Check answer
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="h-12 px-4 text-[14px] font-extrabold text-[#9d94ba] hover:text-white transition cursor-pointer"
              >
                Skip →
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-[20px] bg-[#151722] border-2 border-[#222536] p-5 shrink-0 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              {result.isCorrect ? (
                <div className="w-7 h-7 rounded-full bg-[#102e22] border-2 border-[#1ed760] flex items-center justify-center text-[#1ed760] shrink-0">
                  <Check size={16} strokeWidth={3} />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#381622] border-2 border-[#ff5252] flex items-center justify-center text-[#ff5252] shrink-0">
                  <X size={16} strokeWidth={3} />
                </div>
              )}
              <span className={`text-[17px] font-extrabold tracking-tight ${
                result.isCorrect ? 'text-[#1ed760]' : 'text-[#ff5252]'
              }`}>
                {result.isCorrect ? 'Correct!' : 'Incorrect'}
              </span>
            </div>

            <p className="text-[12px] font-bold uppercase tracking-wider text-[#9d94ba] mb-1">Correct answer:</p>
            <div className="text-[16px] font-extrabold text-white">
              <MathFormattedText text={currentItem?.answer || ''} />
            </div>

            {result.matchedVariant && result.matchedVariant !== currentItem?.answer && (
              <div className="text-[13px] text-[#8e92a8] mt-1.5">
                Matched variant: <span className="text-white font-semibold">{result.matchedVariant}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="mt-4 h-12 w-full rounded-[14px] bg-[#7e57ff] border-2 border-[#9d7eff] shadow-[0px_3px_0px_0px_#4c2fb3] text-white font-extrabold text-[15px] flex items-center justify-center gap-2 tactile-btn cursor-pointer"
            >
              <span>{session.currentIndex >= session.questions.length - 1 ? 'See results' : 'Next'}</span>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
