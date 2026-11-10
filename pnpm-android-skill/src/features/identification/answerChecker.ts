import Fuse from 'fuse.js'
import { areMathExpressionsEquivalent } from '@/lib/mathEvaluator'

interface IdentificationResult {
  isCorrect: boolean
  matchedVariant: string | null
}

export function checkIdentificationAnswer(
  userAnswer: string,
  correctAnswer: string,
  acceptVariants: string[]
): IdentificationResult {
  const trimmed = userAnswer.trim()
  if (trimmed.length === 0) {
    return { isCorrect: false, matchedVariant: null }
  }

  const normalizedInput = trimmed.toLowerCase()
  const normalizedCorrect = correctAnswer.toLowerCase()

  if (normalizedInput === normalizedCorrect) {
    return { isCorrect: true, matchedVariant: correctAnswer }
  }

  // Check mathematical equivalence (e.g. (2^3) == 8, 1/2 == 0.5, 2x+4=10 == 3)
  if (areMathExpressionsEquivalent(trimmed, correctAnswer)) {
    return { isCorrect: true, matchedVariant: correctAnswer }
  }

  for (const variant of acceptVariants) {
    if (areMathExpressionsEquivalent(trimmed, variant)) {
      return { isCorrect: true, matchedVariant: variant }
    }
  }

  const allTargets = [correctAnswer, ...acceptVariants]
  const fuse = new Fuse(allTargets, {
    threshold: 0.25,
    isCaseSensitive: false,
  })

  const results = fuse.search(trimmed)
  if (results.length > 0 && results[0].score !== undefined && results[0].score <= 0.25) {
    return { isCorrect: true, matchedVariant: results[0].item }
  }

  return { isCorrect: false, matchedVariant: null }
}
