'use server'

// Thin server-action wrapper around the shared client-safe evaluator.
// The real logic lives in @/lib/answerEvaluator — identical results on
// both client and server so answer feedback works fully offline.
import { evaluateAnswerLocal } from '@/lib/answerEvaluator'

export async function evaluateAnswer(userAnswer: string, correctAnswer: string) {
  return evaluateAnswerLocal(userAnswer, correctAnswer)
}
