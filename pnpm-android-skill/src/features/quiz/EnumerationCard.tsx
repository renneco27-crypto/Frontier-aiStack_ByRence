'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Eye, Check, X, Mic, MicOff, Volume2, Loader2 } from 'lucide-react'
import MathFormattedText from '@/components/MathFormattedText'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useTTS } from '@/hooks/useTTS'
import { evaluateEnumerationSet, evaluateEnumerationItem, normalizeAnswer, isEnumerationOrdered } from '@/lib/answerEvaluator'
import {
  findEnumerationDefinition,
  getCachedAiDefinition,
  fetchAiDefinition,
} from './enumerationDefinitionExtractor'
import type { Card, Deck } from '@/lib/zodSchemas'

interface EnumerationCardProps {
  topic: string
  items: string[]
  userAnswers: string[]
  onCheckAnswers: () => void
  onAdvance: () => void
  onAnswerChange: (index: number, value: string) => void
  chapter?: string
  subject?: string
  deck?: Deck | null
  cards?: Card[]
  autoVoice?: boolean
}

export default function EnumerationCard({
  topic,
  items,
  userAnswers,
  onCheckAnswers,
  onAdvance,
  onAnswerChange,
  deck,
  cards = [],
  autoVoice = false,
}: EnumerationCardProps) {
  const [checked, setChecked] = useState(false)
  const { speakSingle } = useTTS()
  const { isListening, transcript, interimTranscript, startListening, stopListening, setTranscript } = useSpeechRecognition()
  const [listeningIndex, setListeningIndex] = useState<number | null>(null)
  const [activeFocusIndex, setActiveFocusIndex] = useState<number>(0)
  const [loadingItemDef, setLoadingItemDef] = useState<string | null>(null)
  const [loadingTitleDef, setLoadingTitleDef] = useState(false)

  const handleSpeakItemDefinition = useCallback(
    async (itemText: string) => {
      if (!itemText) return

      // 1. Check notes / flashcards from deck (0ms offline lookup)
      const offlineDef = findEnumerationDefinition(itemText, deck ?? null, cards)
      if (offlineDef) {
        speakSingle(`${itemText}. ${offlineDef}`)
        return
      }

      // 2. Check local database cache ("when pressed just calls it")
      const cachedDef = getCachedAiDefinition(deck?.id || '', topic, itemText)
      if (cachedDef) {
        speakSingle(`${itemText}. ${cachedDef}`)
        return
      }

      // 3. Fallback to AI from aisidebar
      try {
        setLoadingItemDef(itemText)
        const aiDef = await fetchAiDefinition(deck?.id || '', topic, itemText)
        if (aiDef) {
          speakSingle(`${itemText}. ${aiDef}`)
        } else {
          speakSingle(itemText)
        }
      } catch {
        speakSingle(itemText)
      } finally {
        setLoadingItemDef(null)
      }
    },
    [deck, cards, topic, speakSingle]
  )

  const handleSpeakTopicAndAnswers = useCallback(async () => {
    if (!topic) return
    if (!checked) {
      speakSingle(`${topic}. Enumerate ${items.length} items.`)
      return
    }

    try {
      setLoadingTitleDef(true)
      // Concurrently ensure definitions exist for all items
      await Promise.all(
        items.map(async (item) => {
          const offlineDef = findEnumerationDefinition(item, deck ?? null, cards)
          if (!offlineDef && !getCachedAiDefinition(deck?.id || '', topic, item)) {
            await fetchAiDefinition(deck?.id || '', topic, item)
          }
        })
      )

      const itemUnits: string[] = []
      items.forEach((item, idx) => {
        const def =
          findEnumerationDefinition(item, deck ?? null, cards) ||
          getCachedAiDefinition(deck?.id || '', topic, item)
        if (def) {
          itemUnits.push(`Item ${idx + 1}: ${item}. ${def}`)
        } else {
          itemUnits.push(`Item ${idx + 1}: ${item}.`)
        }
      })
      speakSingle(`${topic}. The answers are: ${itemUnits.join(' ')}`)
    } catch {
      const answersText = items.map((it, i) => `${i + 1}. ${it}`).join('. ')
      speakSingle(`${topic}. The answers are: ${answersText}`)
    } finally {
      setLoadingTitleDef(false)
    }
  }, [topic, checked, items, deck, cards, speakSingle])

  const autoCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const prevTopicRef = useRef(topic)

  // Reset checked state and stop mic when topic/card changes
  useEffect(() => {
    if (prevTopicRef.current !== topic) {
      prevTopicRef.current = topic
      setChecked(false)
      setListeningIndex(null)
      setActiveFocusIndex(0)
      setLoadingItemDef(null)
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
      if (autoCheckTimerRef.current) {
        clearTimeout(autoCheckTimerRef.current)
        autoCheckTimerRef.current = null
      }
      stopListening()
    }
  }, [topic, stopListening])

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
      if (autoCheckTimerRef.current) {
        clearTimeout(autoCheckTimerRef.current)
        autoCheckTimerRef.current = null
      }
      stopListening()
    }
  }, [stopListening])

  const isOrdered = useMemo(() => isEnumerationOrdered(topic), [topic])

  // Evaluate all slots using the shared Enumeration evaluator so live glow & Check Answers match 100%
  const evaluation = useMemo(
    () => evaluateEnumerationSet(userAnswers, items, topic),
    [userAnswers, items, topic]
  )
  const { results, correctCount, totalCount } = evaluation

  const lastProcessedRef = useRef('')

  // Reset listening state when checked
  const handleCheck = async () => {
    if (autoCheckTimerRef.current) {
      clearTimeout(autoCheckTimerRef.current)
      autoCheckTimerRef.current = null
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    stopListening()
    setListeningIndex(null)
    setChecked(true)
    onCheckAnswers()

    if (autoVoice && items.length > 0) {
      try {
        setLoadingTitleDef(true)
        // Ensure all missing item definitions are fetched and cached
        await Promise.all(
          items.map(async (item) => {
            const offlineDef = findEnumerationDefinition(item, deck ?? null, cards)
            if (!offlineDef && !getCachedAiDefinition(deck?.id || '', topic, item)) {
              await fetchAiDefinition(deck?.id || '', topic, item)
            }
          })
        )

        const spokenUnits: string[] = []
        items.forEach((item, idx) => {
          const def =
            findEnumerationDefinition(item, deck ?? null, cards) ||
            getCachedAiDefinition(deck?.id || '', topic, item)
          if (def) {
            spokenUnits.push(`Item ${idx + 1}: ${item}. ${def}`)
          } else {
            spokenUnits.push(`Item ${idx + 1}: ${item}.`)
          }
        })
        speakSingle(`${topic}. ${spokenUnits.join(' ')}`)
      } catch {
        const answersText = items.map((it, i) => `${i + 1}. ${it}`).join('. ')
        speakSingle(`${topic}. ${answersText}`)
      } finally {
        setLoadingTitleDef(false)
      }
    }
  }

  // Auto-check immediately when all items are filled correctly
  useEffect(() => {
    if (!checked && correctCount === totalCount && totalCount > 0) {
      if (autoCheckTimerRef.current) clearTimeout(autoCheckTimerRef.current)
      autoCheckTimerRef.current = setTimeout(() => {
        handleCheck()
      }, 400)
    }
    return () => {
      if (autoCheckTimerRef.current) clearTimeout(autoCheckTimerRef.current)
    }
  }, [checked, correctCount, totalCount])

  const handleToggleBottomMic = () => {
    if (isListening) {
      stopListening()
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
    } else {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
      setTranscript('')
      lastProcessedRef.current = ''
      startListening()
    }
  }

  // Real-time word-by-word semantic / item matching from continuous speech
  useEffect(() => {
    if (!isListening) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
      lastProcessedRef.current = ''
      return
    }

    const fullSpoken = (transcript + ' ' + interimTranscript).trim()
    if (!fullSpoken || fullSpoken === lastProcessedRef.current) return
    lastProcessedRef.current = fullSpoken

    // Reset silence timer on every spoken chunk: if user speaks and goes silent for 5.5s, auto-check
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = setTimeout(() => {
      if (!checked && userAnswers.some(a => a && a.trim().length > 0)) {
        handleCheck()
      }
    }, 5500)

    // Split spoken speech into natural chunks by comma, punctuation, 'and', 'or', 'then', 'also'
    const naturalChunks = fullSpoken
      .split(/[,;\.]|\s+(?:and|or|then|also|as well as)\s+/i)
      .map((s) => s.trim())
      .filter(Boolean)

    // Build sliding word windows (1 to 4 words) from the incoming stream
    const words = fullSpoken.split(/\s+/).filter(Boolean)
    const windowChunks: string[] = []
    for (let len = 1; len <= 4; len++) {
      for (let w = 0; w <= words.length - len; w++) {
        windowChunks.push(words.slice(w, w + len).join(' '))
      }
    }

    const allCandidates = [...new Set([...naturalChunks, ...windowChunks])]

    // Track which items are already matched/filled
    const matchedItemIndices = new Set<number>()
    userAnswers.forEach((ans, slotIdx) => {
      if (!ans) return
      if (isOrdered) {
        if (evaluateEnumerationItem(ans, items[slotIdx]).matched) {
          matchedItemIndices.add(slotIdx)
        }
      } else {
        items.forEach((item, expIdx) => {
          if (evaluateEnumerationItem(ans, item).matched) {
            matchedItemIndices.add(expIdx)
          }
        })
      }
    })

    for (const cand of allCandidates) {
      if (cand.length < 2) continue
      for (let expIdx = 0; expIdx < items.length; expIdx++) {
        if (matchedItemIndices.has(expIdx)) continue
        const item = items[expIdx]
        const evalRes = evaluateEnumerationItem(cand, item)
        if (evalRes.matched) {
          let targetSlot = -1
          if (isOrdered) {
            // Must match its exact slot!
            targetSlot = expIdx
          } else {
            // Find appropriate slot for this matched item
            if (!userAnswers[expIdx] || !evaluateEnumerationItem(userAnswers[expIdx], items[expIdx]).matched) {
              targetSlot = expIdx
            } else {
              targetSlot = userAnswers.findIndex((a, idx) => !a || !evaluateEnumerationItem(a, items[idx]).matched)
            }
          }

          if (targetSlot !== -1 && targetSlot < items.length) {
            onAnswerChange(targetSlot, item)
            matchedItemIndices.add(expIdx)
          }
        }
      }
    }

    // Do NOT write spoken chatter into slot 1 (activeFocusIndex 0).
    // The user's speech only lights up slots when an actual item matches!
  }, [isListening, transcript, interimTranscript, items, userAnswers, activeFocusIndex, onAnswerChange, results, isOrdered, checked])

  const handleAdvance = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (autoCheckTimerRef.current) {
      clearTimeout(autoCheckTimerRef.current)
      autoCheckTimerRef.current = null
    }
    stopListening()
    setListeningIndex(null)
    setChecked(false)
    setLoadingItemDef(null)
    onAdvance()
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-lg p-4 sm:p-7 flex flex-col flex-1 min-h-0 overflow-hidden">
      <p className="text-xs text-[var(--color-text-muted)] text-center mb-1 flex-shrink-0">
        Type or speak each item, then check answers
      </p>
      <div className="font-['Playfair_Display'] text-xl sm:text-2xl text-center mb-2 text-[var(--color-text-primary)] flex items-center justify-center gap-2 flex-shrink-0">
        <MathFormattedText text={topic} />
        <button
          type="button"
          onClick={handleSpeakTopicAndAnswers}
          disabled={loadingTitleDef}
          className={`p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors ${
            loadingTitleDef ? 'opacity-60 animate-pulse' : ''
          }`}
          title={checked ? "Read topic and answers with explanations" : "Pronounce topic"}
          aria-label={checked ? "Read topic and answers with explanations" : "Pronounce topic"}
        >
          {loadingTitleDef ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Volume2 size={18} />
          )}
        </button>
      </div>
      <div className="mx-auto w-full max-w-md border-b-2 border-[var(--color-border-strong)] flex-shrink-0 mb-1.5" />

      <div className="flex items-center justify-center gap-2 mb-2 flex-shrink-0">
        <span className="text-xs text-[var(--color-text-muted)]">
          {items.length} items
        </span>
        {checked && (
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              correctCount === totalCount
                ? 'bg-[var(--color-know)]/15 text-[var(--color-know)] border-[var(--color-know)]/40 shadow-[0_0_12px_var(--color-know)]'
                : correctCount > 0
                  ? 'bg-emerald-500/15 text-[var(--color-know)] border-[var(--color-know)]/30'
                  : 'bg-[var(--color-dontknow)]/15 text-[var(--color-dontknow)] border-[var(--color-dontknow)]/30'
            }`}
          >
            Scored {correctCount} / {totalCount} Correct
          </span>
        )}
      </div>

      <div className="space-y-2.5 max-w-md mx-auto flex-1 min-h-0 w-full overflow-y-auto pr-1 styled-scrollbar">
        {items.map((_, i) => {
          const globalIndex = i
          const answer = userAnswers[globalIndex] ?? ''
          const r = results[globalIndex]
          const isSlotListening = isListening && (listeningIndex ?? activeFocusIndex) === globalIndex
          const isExactSameText =
            normalizeAnswer(answer) === normalizeAnswer(r?.expected ?? '') &&
            answer.trim().toLowerCase() === (r?.expected ?? '').trim().toLowerCase()

          return (
            <div key={globalIndex} className="flex items-center gap-3 overflow-hidden min-w-0">
              <span
                className={`w-7 h-7 rounded-full text-sm font-medium flex items-center justify-center flex-shrink-0 transition-all ${
                  r?.correct
                    ? 'bg-[var(--color-know-soft)] text-[var(--color-know)] ring-2 ring-[var(--color-know)]/50 shadow-[0_0_10px_var(--color-know)]'
                    : !checked
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                      : 'bg-[var(--color-dontknow-soft)] text-[var(--color-dontknow)]'
                }`}
              >
                {r?.correct ? <Check size={14} /> : globalIndex + 1}
              </span>

              {!checked ? (
                <div className="flex-1 flex items-center min-w-0">
                  <div className="relative flex-1 min-w-0">
                    <input
                      type="text"
                      value={answer}
                      onFocus={() => setActiveFocusIndex(globalIndex)}
                      onChange={(e) => onAnswerChange(globalIndex, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (globalIndex < items.length - 1) {
                            setActiveFocusIndex(globalIndex + 1)
                          } else {
                            handleCheck()
                          }
                        }
                      }}
                      placeholder={`Item ${globalIndex + 1} answer...`}
                      className={`w-full px-4 py-3 rounded-xl border bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none min-w-0 transition-all duration-200 ${
                        r?.correct
                          ? 'border-2 border-[var(--color-know)] bg-[var(--color-know)]/10 shadow-[0_0_16px_var(--color-know)] text-[var(--color-know)] font-semibold'
                          : isSlotListening
                            ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30 shadow-sm'
                            : 'border-[var(--color-border)] focus:border-[var(--color-accent)]'
                      }`}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                    {r?.correct && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-know)] flex items-center gap-1 text-xs font-semibold pointer-events-none">
                        <Check size={15} />
                      </span>
                    )}
                  </div>
                </div>
              ) : r?.correct ? (
                <div className="flex-1 px-4 py-3 rounded-xl border-2 border-[var(--color-know)] shadow-[0_0_16px_var(--color-know)] bg-[var(--color-know)]/10 text-[var(--color-text-primary)] w-full min-w-0 flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    {!isExactSameText && answer.trim() && (
                      <span className="text-xs text-[var(--color-know)] opacity-90 truncate">
                        You answered: <span className="font-semibold">{answer}</span>
                      </span>
                    )}
                    <div className="text-sm font-semibold text-[var(--color-text-primary)] break-words">
                      <span className="text-[var(--color-know)] font-bold mr-1">Correct:</span>
                      <MathFormattedText text={r.expected} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSpeakItemDefinition(r.expected)}
                    disabled={loadingItemDef === r.expected}
                    className={`p-1.5 rounded-lg text-[var(--color-know)] hover:bg-[var(--color-know)]/20 transition-colors flex-shrink-0 ${
                      loadingItemDef === r.expected ? 'opacity-60 animate-pulse' : ''
                    }`}
                    title={loadingItemDef === r.expected ? "Loading definition..." : "Speak answer and definition"}
                    aria-label={`Listen to ${r.expected}`}
                  >
                    {loadingItemDef === r.expected ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Volume2 size={16} />
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex-1 px-4 py-3 rounded-xl border-2 border-[var(--color-dontknow)] bg-[var(--color-bg)] text-[var(--color-text-primary)] w-full min-w-0 flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    {answer.trim() && (
                      <span className="line-through text-[var(--color-dontknow)] opacity-80 text-xs truncate">
                        You answered: {answer}
                      </span>
                    )}
                    <div className="text-sm font-medium text-[var(--color-text-primary)] break-words">
                      <span className="text-[var(--color-dontknow)] font-semibold mr-1">Correct:</span>
                      <MathFormattedText text={r?.expected ?? ''} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSpeakItemDefinition(r?.expected ?? '')}
                    disabled={loadingItemDef === (r?.expected ?? '')}
                    className={`p-1.5 rounded-lg text-[var(--color-dontknow)] hover:bg-[var(--color-dontknow)]/20 transition-colors flex-shrink-0 ${
                      loadingItemDef === (r?.expected ?? '') ? 'opacity-60 animate-pulse' : ''
                    }`}
                    title={loadingItemDef === (r?.expected ?? '') ? "Loading definition..." : "Speak answer and definition"}
                    aria-label={`Listen to ${r?.expected ?? ''}`}
                  >
                    {loadingItemDef === (r?.expected ?? '') ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Volume2 size={16} />
                    )}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-col items-center gap-2 mt-3 flex-shrink-0 w-full max-w-md mx-auto">
        {!checked ? (
          <>
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleBottomMic}
                className={`p-3.5 rounded-full transition-all shadow-md ${
                  isListening
                    ? 'bg-[var(--color-know)]/20 text-[var(--color-know)] scale-110 animate-pulse shadow-[0_0_16px_var(--color-know)]'
                    : 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)] hover:scale-105'
                }`}
                title={isListening ? 'Stop listening' : 'Start speaking answers'}
              >
                {isListening ? <Mic size={22} /> : <MicOff size={22} />}
              </button>
              <span className="text-xs text-[var(--color-text-muted)] h-4">
                {isListening
                  ? 'Listening… speak items in any order'
                  : 'Tap mic to speak items in any order'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCheck}
              className="h-12 w-full rounded-[14px] bg-[#7e57ff] border-2 border-[#9d7eff] shadow-[0px_3px_0px_0px_#4c2fb3] text-white font-extrabold text-[15px] flex items-center justify-center gap-2 tactile-btn cursor-pointer"
            >
              <Eye size={17} />
              <span>Check Answers</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleAdvance}
            className="h-12 w-full rounded-[14px] bg-[#7e57ff] border-2 border-[#9d7eff] shadow-[0px_3px_0px_0px_#4c2fb3] text-white font-extrabold text-[15px] flex items-center justify-center gap-2 tactile-btn cursor-pointer"
          >
            <span>Next card</span>
            <Check size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
