'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import { useQuizSession } from '@/hooks/useQuizSession'
import { shuffleSeeded } from '@/lib/shuffleSeeded'
import StudyHeader, { HeaderIconButton } from '@/components/StudyHeader'
import MCOption from '@/features/quiz/MCOption'
import QuizSummary from '@/features/quiz/QuizSummary'
import MathFormattedText from '@/components/MathFormattedText'
import { soundEngine } from '@/utils/soundEngine'
import type { MultipleChoiceItem, MCOption as MCOptionType } from '@/lib/zodSchemas'

type MCOptionState = 'default' | 'selected' | 'correct' | 'wrong' | 'reveal'

export default function MultipleChoiceClient() {
  const params = useParams()
  const router = useRouter()
  const rawDeckId = params?.deckId as string
  const deckId = (rawDeckId && rawDeckId !== '_offline')
    ? rawDeckId
    : (typeof window !== 'undefined' ? window.location.pathname.split('/study/')[1]?.split('/')[0]?.split('?')[0] || '' : '')

  const session = useQuizSession(deckId, 'multiple_choice')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [optionStates, setOptionStates] = useState<MCOptionState[]>(['default', 'default', 'default', 'default'])

  const loading = session.questions.length === 0

  const mcQuestion = useMemo(() => {
    if (!session.currentQuestion) return null
    const q = session.currentQuestion as MultipleChoiceItem
    const allOptions = shuffleSeeded([q.correct, ...q.distractors], Date.now() + 2)
    const correctIndex = allOptions.indexOf(q.correct)
    const labels: MCOptionType['label'][] = ['A', 'B', 'C', 'D']
    const options: MCOptionType[] = allOptions.map((text, i) => ({
      label: labels[i],
      text,
    }))
    return { question: q.question, correct: q.correct, options, correctIndex, chapter: q.chapter, subject: q.subject }
  }, [session.currentQuestion])

  const handleSelect = useCallback(
    (index: number) => {
      if (session.answerState !== 'unanswered') return
      setSelectedIndex(index)
      setOptionStates(
        optionStates.map((s, i) => (i === index ? 'selected' : 'default'))
      )
    },
    [session.answerState, optionStates]
  )

  const handleCheck = useCallback(() => {
    if (selectedIndex === null || !mcQuestion) return
    const selectedText = mcQuestion.options[selectedIndex].text
    const isCorrect = selectedText === mcQuestion.correct
    if (isCorrect) {
      soundEngine.play('poppy', 18)
      setOptionStates(optionStates.map((s, i) => (i === selectedIndex ? 'correct' : s)))
    } else {
      soundEngine.play('thocky', 18)
      setOptionStates(optionStates.map((s, i) => {
        if (i === selectedIndex) return 'wrong'
        if (mcQuestion.options[i].text === mcQuestion.correct) return 'reveal'
        return s
      }))
    }
    session.handleAnswer(selectedText, isCorrect)
  }, [selectedIndex, mcQuestion, optionStates, session])

  const handleNext = useCallback(() => {
    soundEngine.play('thocky')
    setSelectedIndex(null)
    setOptionStates(['default', 'default', 'default', 'default'])
    session.handleNext()
  }, [session])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (session.showSummary) return
      const keyMap: Record<string, number> = {
        a: 0, A: 0, '1': 0,
        b: 1, B: 1, '2': 1,
        c: 2, C: 2, '3': 2,
        d: 3, D: 3, '4': 3,
      }
      if (keyMap[e.key] !== undefined) {
        handleSelect(keyMap[e.key])
      }
      if (e.key === 'Enter') {
        if (session.answerState === 'unanswered' && selectedIndex !== null) {
          handleCheck()
        } else if (session.answerState !== 'unanswered') {
          handleNext()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [session.showSummary, session.answerState, selectedIndex, handleSelect, handleCheck, handleNext])

  if (loading) {
    return (
      <div className="h-[100dvh] bg-[#0b0c14] flex flex-col justify-between px-4 pt-2 pb-6 max-w-[520px] mx-auto w-full">
        <StudyHeader onClose={() => router.push('/study/' + deckId)} percent={10} />
        <div className="rounded-[28px] bg-[#1b0e3e] border-2 border-[#2f1e5e] p-6 flex-1 my-3 animate-pulse" />
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-[16px] bg-[#151722] border-2 border-[#222536] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (session.questions.length === 0) {
    return (
      <div className="h-[100dvh] bg-[#0b0c14] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-[#8e92a8] text-[15px] font-semibold">No multiple choice questions in this deck</p>
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
          mode="Multiple Choice"
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

      {/* Main Focus: Question Card + Options */}
      <div className="flex-1 flex flex-col justify-between my-2 gap-3 min-h-0 overflow-y-auto no-scrollbar">
        {/* Question Card (.flashcard-face container) */}
        <div className="rounded-[28px] bg-[#1b0e3e] border-2 border-[#2f1e5e] p-5 sm:p-6 shadow-2xl shrink-0">
          <div className="text-[12px] font-bold uppercase tracking-wider text-[#9d94ba] flex items-center justify-between">
            <span className="truncate max-w-[200px]">{mcQuestion?.chapter || 'Multiple Choice'}</span>
            {mcQuestion?.subject && (
              <span className="text-[#8e92a8] text-[12px] font-semibold">{mcQuestion.subject}</span>
            )}
          </div>
          <div className="font-display text-[18px] sm:text-[21px] font-extrabold text-white mt-3 leading-snug">
            <MathFormattedText text={mcQuestion?.question || ''} />
          </div>
        </div>

        {/* Options List */}
        <div className="flex flex-col gap-2.5 flex-1 justify-center">
          {mcQuestion?.options.map((opt, i) => (
            <MCOption
              key={i}
              label={opt.label}
              text={opt.text}
              state={optionStates[i] ?? 'default'}
              onClick={() => handleSelect(i)}
              disabled={session.answerState !== 'unanswered'}
            />
          ))}
        </div>
      </div>

      {/* Bottom Action Button (Gold standard 3D tactile) */}
      <div className="pt-2 pb-safe shrink-0">
        {session.answerState === 'unanswered' ? (
          <button
            type="button"
            onClick={handleCheck}
            disabled={selectedIndex === null}
            className="h-12 w-full rounded-[14px] bg-[#7e57ff] border-2 border-[#9d7eff] shadow-[0px_3px_0px_0px_#4c2fb3] text-white font-extrabold text-[15px] flex items-center justify-center gap-2 tactile-btn cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            Check answer
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="h-12 w-full rounded-[14px] bg-[#7e57ff] border-2 border-[#9d7eff] shadow-[0px_3px_0px_0px_#4c2fb3] text-white font-extrabold text-[15px] flex items-center justify-center gap-2 tactile-btn cursor-pointer"
          >
            <span>{session.currentIndex >= session.questions.length - 1 ? 'See results' : 'Next'}</span>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
