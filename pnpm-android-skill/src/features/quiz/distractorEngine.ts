import { shuffleSeeded } from '@/lib/shuffleSeeded'
import type { Card, MCQuestion, MCOption } from '@/lib/zodSchemas'

function cleanText(s: string): string {
  return (s || '').trim().replace(/^["']|["']$/g, '').trim()
}

/**
 * Calculates similarity score between candidate and target answer.
 * Higher score = closer in word count, character length, and grammatical shape.
 */
export function scoreDistractorCandidate(target: string, candidate: string): number {
  const t = cleanText(target)
  const c = cleanText(candidate)

  if (!c || c.toLowerCase() === t.toLowerCase()) return -1

  const tWords = t.split(/\s+/).filter(Boolean).length
  const cWords = c.split(/\s+/).filter(Boolean).length
  const wordDiff = Math.abs(cWords - tWords)
  const wordScore = 1 - wordDiff / Math.max(tWords, cWords, 1)

  const tLen = t.length
  const cLen = c.length
  const lenDiff = Math.abs(cLen - tLen)
  const lenScore = 1 - lenDiff / Math.max(tLen, cLen, 1)

  // Combined score emphasizing both length balance and similar wordiness
  return wordScore * 0.45 + lenScore * 0.55
}

/**
 * Selects the top `count` distractors from candidates that have semantic,
 * same-word, and semi-same length balance to the correct answer.
 */
export function selectBestDistractors(
  targetAnswer: string,
  candidateAnswers: string[],
  count: number = 3
): string[] {
  const targetClean = cleanText(targetAnswer)
  const targetLower = targetClean.toLowerCase()

  const seen = new Set<string>([targetLower])
  const scored: Array<{ text: string; score: number }> = []

  for (const raw of candidateAnswers) {
    const text = cleanText(raw)
    const lower = text.toLowerCase()
    if (!text || seen.has(lower)) continue

    // Reject exact substrings or parent strings that give away or duplicate the answer
    if (lower.length > 3 && targetLower.length > 3) {
      if (lower.includes(targetLower) || targetLower.includes(lower)) continue
    }

    seen.add(lower)
    const score = scoreDistractorCandidate(targetClean, text)
    if (score >= 0) {
      scored.push({ text, score })
    }
  }

  // Sort by highest score (closest in word count and length)
  scored.sort((a, b) => b.score - a.score)

  const selected = scored.slice(0, count).map((item) => item.text)

  // If still fewer than count, synthesize plausible variations matching word count/length
  let fallbackSeed = 1
  while (selected.length < count) {
    const alt = createPlausibleVariation(targetClean, fallbackSeed++)
    if (!selected.includes(alt) && alt !== targetClean) {
      selected.push(alt)
    }
  }

  return selected.slice(0, count)
}

/**
 * Creates a plausible alternative distractor matching target length and word structure
 * when insufficient cards exist in the deck.
 */
function createPlausibleVariation(target: string, seed: number): string {
  const words = target.split(/\s+/).filter(Boolean)
  if (words.length === 1) {
    const suffixes = ['Mechanism', 'Factor', 'Principle', 'Process', 'Component', 'Property']
    const choice = suffixes[(seed - 1) % suffixes.length]
    return `${words[0]} ${choice}`
  }

  // Multi-word answer: alter non-initial key term
  const variants = [
    words.slice(0, -1).concat('System').join(' '),
    words.slice(0, -1).concat('Protocol').join(' '),
    words.slice(0, -1).concat('Model').join(' '),
    words.slice(0, -1).concat('Pattern').join(' '),
  ]
  return variants[(seed - 1) % variants.length] || `${target} alternative`
}

export function buildMCQuestion(targetCard: Card, allCards: Card[]): MCQuestion {
  const others = allCards.filter((c) => c.id !== targetCard.id)

  // Tier 1: Cards from identical subject and lesson
  const poolA = others
    .filter((c) => c.subject === targetCard.subject && c.lesson === targetCard.lesson)
    .map((c) => c.back || c.front)

  // Tier 2: Cards from identical chapter or type
  const poolB = others
    .filter((c) => c.chapter === targetCard.chapter || c.type === targetCard.type)
    .map((c) => c.back || c.front)

  // Tier 3: All remaining deck cards
  const poolC = others.map((c) => c.back || c.front)

  const candidatePool = [...poolA, ...poolB, ...poolC]
  const targetAnswer = targetCard.back || targetCard.front

  const distractors = selectBestDistractors(targetAnswer, candidatePool, 3)

  const allOptions = shuffleSeeded([targetAnswer, ...distractors], Date.now() + 2)
  const correctIndex = allOptions.indexOf(targetAnswer)

  const labels: MCOption['label'][] = ['A', 'B', 'C', 'D']
  const options: MCOption[] = allOptions.map((text, i) => ({
    label: labels[i],
    text,
  }))

  return {
    question: targetCard.front,
    correct: targetAnswer,
    options,
    correctIndex,
  }
}
