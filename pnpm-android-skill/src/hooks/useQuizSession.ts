'use client'

import { useState, useEffect, useCallback } from 'react'
import { getDeck } from '@/db/deckRepository'
import { getCardsByDeck } from '@/db/cardRepository'
import { buildMCQuestion } from '@/features/quiz/distractorEngine'
import { useStatsStore } from '@/store/statsStore'
import { computeAccuracy } from '@/features/stats/statsCalculator'
import type { QuizItem, QuizMode, AnswerState } from '@/lib/zodSchemas'

function extractCorrectAnswer(q: QuizItem): string | boolean {
  if (q.mode === 'multiple_choice') return q.correct
  if (q.mode === 'true_false') return q.correct
  return 'got_it'
}

export function useQuizSession(deckId: string, mode: QuizMode) {
  const recordCorrect = useStatsStore((s) => s.recordCorrect)
  const recordWrong = useStatsStore((s) => s.recordWrong)

  const [questions, setQuestions] = useState<QuizItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answerState, setAnswerState] = useState<AnswerState>('unanswered')
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [showSummary, setShowSummary] = useState(false)

  useEffect(() => {
    const load = async () => {
      const deck = await getDeck(deckId)
      if (deck) {
        let filtered = (deck.quizItems || []).filter((q) => q.mode === mode)
        if (filtered.length === 0 && mode === 'multiple_choice') {
          const cards = await getCardsByDeck(deckId)
          const validCards = cards.filter(
            (c) => c.front && c.back && (c.type as string) !== 'tf' && (c.type as string) !== 'true_false' && (c.type as string) !== 'keyword'
          )
          if (validCards.length > 0) {
            filtered = validCards.map((card) => {
              const built = buildMCQuestion(card, validCards)
              return {
                mode: 'multiple_choice',
                question: built.question,
                correct: built.correct,
                distractors: built.options.filter((o) => o.text !== built.correct).map((o) => o.text).slice(0, 3),
                chapter: card.chapter || 'General',
                subject: card.subject || deck.subject || 'General',
              } as QuizItem
            })
          }
        }
        setQuestions(filtered.sort(() => Math.random() - 0.5))
      }
    }
    load()
  }, [deckId, mode])

  const currentQuestion = questions[currentIndex] ?? null

  const handleAnswer = useCallback(
    (answer: string | boolean, isCorrectOverride?: boolean) => {
      if (answerState !== 'unanswered') return

      const q = questions[currentIndex]
      if (!q) return

      const isCorrect = isCorrectOverride ?? (answer === extractCorrectAnswer(q))

      if (isCorrect) {
        setCorrect((c) => c + 1)
        const studyMode = mode === 'multiple_choice' ? 'mc' : mode === 'true_false' ? 'true_false' : 'enumeration'
        recordCorrect(deckId, studyMode)
      } else {
        setWrong((w) => w + 1)
        recordWrong(deckId)
      }

      setAnswerState(isCorrect ? 'correct' : 'wrong')
    },
    [answerState, currentIndex, questions, mode, deckId, recordCorrect, recordWrong]
  )

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1)
      setAnswerState('unanswered')
    } else {
      setShowSummary(true)
    }
  }, [currentIndex, questions.length])

  const handleRestart = useCallback(() => {
    setQuestions((q) => [...q].sort(() => Math.random() - 0.5))
    setCurrentIndex(0)
    setAnswerState('unanswered')
    setCorrect(0)
    setWrong(0)
    setShowSummary(false)
  }, [])

  const accuracy = computeAccuracy(correct, wrong)

  return {
    questions,
    currentIndex,
    currentQuestion,
    answerState,
    correct,
    wrong,
    showSummary,
    accuracy,
    handleAnswer,
    handleNext,
    handleRestart,
  }
}
