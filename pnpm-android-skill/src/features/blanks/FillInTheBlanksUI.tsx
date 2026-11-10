'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Mic, MicOff, CheckCircle2, XCircle, RotateCcw, SlidersHorizontal, X, Sparkles, Shuffle } from 'lucide-react'
import { TextToken, parseBlanks, BlankStrategy } from './parseBlanks'
import confetti from 'canvas-confetti'
import { areMathExpressionsEquivalent } from '@/lib/mathEvaluator'

interface FillInTheBlanksUIProps {
  tokens: TextToken[]
  rawText?: string
  onReset?: () => void
  onReconfigureBlanks?: (strategy: BlankStrategy, density: number) => void
}

// Simple fuzzy match: normalize and check similarity
function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').trim()
}
function isMatch(spoken: string, expected: string): boolean {
  if (areMathExpressionsEquivalent(spoken, expected)) return true

  const a = normalize(spoken)
  const b = normalize(expected)
  if (!a || !b) return false
  if (a === b) return true
  // Allow 1-char edit distance for short words, 2 for longer
  const maxDist = b.length <= 5 ? 1 : 2
  return levenshtein(a, b) <= maxDist
}
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

export default function FillInTheBlanksUI({
  tokens: initialTokens,
  rawText,
  onReset,
  onReconfigureBlanks,
}: FillInTheBlanksUIProps) {
  // Local active tokens state so the hidden drawer can re-generate on the fly
  const [tokens, setTokens] = useState<TextToken[]>(initialTokens)
  const [strategy, setStrategy] = useState<BlankStrategy>('smart')
  const [blankDensity, setBlankDensity] = useState<number>(0.25)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Re-sync if parent updates initialTokens
  useEffect(() => {
    setTokens(initialTokens)
  }, [initialTokens])

  // Reconstruct full text from tokens if rawText wasn't passed directly
  const fullText = useMemo(() => {
    if (rawText && rawText.trim()) return rawText
    return tokens.map(t => t.text).join('')
  }, [rawText, tokens])

  // Only word tokens matter for tracking
  const wordTokens = useMemo(() => tokens.filter(t => t.isWord), [tokens])
  const tokensKey = useMemo(() => tokens.map(t => `${t.id}:${t.text}:${t.isBlank}`).join('|'), [tokens])

  // cursor = index into wordTokens of the word we expect next
  const [cursor, setCursor] = useState(0)
  // which blank tokens are correctly answered
  const [correct, setCorrect] = useState<Set<string>>(new Set())
  // which blank tokens are answered incorrectly (glow red)
  const [wrong, setWrong] = useState<Set<string>>(new Set())
  // what the user filled in for each blank (shown inside blank)
  const [filled, setFilled] = useState<Record<string, string>>({})
  const [hasWon, setHasWon] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [typedInput, setTypedInput] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor
  const correctRef = useRef(correct)
  correctRef.current = correct
  const wrongRef = useRef(wrong)
  wrongRef.current = wrong
  const filledRef = useRef(filled)
  filledRef.current = filled
  const hasWonRef = useRef(hasWon)
  hasWonRef.current = hasWon

  // Advance cursor past all non-blank words from a given position
  const skipNonBlanks = useCallback((from: number): number => {
    let i = from
    while (i < wordTokens.length && !wordTokens[i].isBlank) i++
    return i
  }, [wordTokens])

  // On mount or when the actual text/tokens change, skip leading non-blank words & reset win state
  useEffect(() => {
    setCursor(skipNonBlanks(0))
    setCorrect(new Set())
    setWrong(new Set())
    setFilled({})
    setHasWon(false)
    hasWonRef.current = false
    correctRef.current = new Set()
    wrongRef.current = new Set()
    filledRef.current = {}
    setTypedInput('')
  }, [tokensKey, skipNonBlanks])

  const processWords = useCallback((spokenWords: string[]) => {
    let cur = cursorRef.current
    const newCorrect = new Set(correctRef.current)
    const newWrong = new Set(wrongRef.current)
    const newFilled = { ...filledRef.current }

    for (let w = 0; w < spokenWords.length; w++) {
      if (cur >= wordTokens.length) break
      const word = spokenWords[w]
      const expected = wordTokens[cur]

      if (expected.isBlank) {
        if (isMatch(word, expected.text)) {
          // Direct match: correct!
          newCorrect.add(expected.id)
          newWrong.delete(expected.id)
          newFilled[expected.id] = expected.text
          cur++
          cur = skipNonBlanks(cur)
        } else {
          // Check ahead up to 4 words if this spoken word is actually an upcoming anchor word
          let anchorIdx = -1
          for (let k = cur + 1; k < Math.min(cur + 5, wordTokens.length); k++) {
            if (!wordTokens[k].isBlank && isMatch(word, wordTokens[k].text)) {
              anchorIdx = k
              break
            }
          }

          if (anchorIdx !== -1) {
            // User skipped this blank and spoke an upcoming anchor word
            cur = anchorIdx + 1
            cur = skipNonBlanks(cur)
          } else {
            // Spoken word was an incorrect attempt for this blank: glow red!
            newWrong.add(expected.id)
            newCorrect.delete(expected.id)
            newFilled[expected.id] = word
            cur++
            cur = skipNonBlanks(cur)
          }
        }
      } else {
        // Non-blank anchor word
        if (isMatch(word, expected.text)) {
          cur++
          cur = skipNonBlanks(cur)
        } else if (cur + 1 < wordTokens.length && isMatch(word, wordTokens[cur + 1].text)) {
          // Dropped word recovery
          cur = cur + 2
          cur = skipNonBlanks(cur)
        }
      }
    }

    // Check if all blanks are completed
    const allBlanks = tokens.filter(t => t.isBlank)
    const allDone = allBlanks.length > 0 && allBlanks.every(t => newCorrect.has(t.id))

    if (!allDone) {
      // Point cursor to the first unresolved (wrong or empty) blank so user can fix it
      const firstUnresolved = wordTokens.findIndex(w => w.isBlank && !newCorrect.has(w.id))
      if (firstUnresolved !== -1 && (cur >= wordTokens.length || newWrong.size > 0)) {
        cur = firstUnresolved
      }
    }

    correctRef.current = newCorrect
    wrongRef.current = newWrong
    filledRef.current = newFilled
    cursorRef.current = cur
    setCorrect(newCorrect)
    setWrong(newWrong)
    setFilled(newFilled)
    setCursor(cur)

    // Win check: only pop confetti when ALL blanks are completed
    if (allDone && !hasWonRef.current) {
      hasWonRef.current = true
      allBlanks.forEach(b => {
        newFilled[b.id] = b.text
      })
      newWrong.clear()
      wrongRef.current = new Set()
      filledRef.current = newFilled
      setWrong(new Set())
      setFilled(newFilled)
      setHasWon(true)

      // Stop speech recognition cleanly
      try {
        recognitionRef.current?.stop()
      } catch (e) {}
      setIsListening(false)

      confetti({ particleCount: 180, spread: 80, origin: { y: 0.6 } })
    }
  }, [wordTokens, tokens, skipNonBlanks])

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous = true
    r.interimResults = true
    r.lang = 'en-US'

    r.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const words = event.results[i][0].transcript.trim().split(/\s+/)
          processWords(words)
        }
      }
    }

    r.onerror = () => setIsListening(false)
    r.onend = () => setIsListening(false)
    recognitionRef.current = r
    r.start()
    setIsListening(true)
  }, [processWords])

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.abort()
    } catch (e) {
      recognitionRef.current?.stop()
    }
    recognitionRef.current = null
    setIsListening(false)
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) stopListening()
    else startListening()
  }, [isListening, startListening, stopListening])

  const handleReset = () => {
    stopListening()
    setCursor(skipNonBlanks(0))
    setCorrect(new Set())
    setWrong(new Set())
    setFilled({})
    setHasWon(false)
    hasWonRef.current = false
    correctRef.current = new Set()
    wrongRef.current = new Set()
    filledRef.current = {}
    setTypedInput('')
  }

  // Pressing in any blank: Jump active cursor directly to that blank so typing or talking immediately starts there!
  const handleSelectBlank = (tokenId: string) => {
    const idx = wordTokens.findIndex(w => w.id === tokenId)
    if (idx !== -1 && !hasWon) {
      setCursor(idx)
      cursorRef.current = idx

      // Reset mistake status on this blank so user can speak or type fresh
      setWrong(prev => {
        const next = new Set(prev)
        next.delete(tokenId)
        wrongRef.current = next
        return next
      })

      setFilled(prev => {
        const next = { ...prev }
        delete next[tokenId]
        filledRef.current = next
        return next
      })

      setCorrect(prev => {
        const next = new Set(prev)
        next.delete(tokenId)
        correctRef.current = next
        return next
      })

      setTypedInput('')
      inputRef.current?.focus()

      // Flush speech recognition stream so previously spoken words don't match newly selected blank
      if (recognitionRef.current && isListening) {
        try {
          recognitionRef.current.abort()
          setTimeout(() => {
            startListening()
          }, 80)
        } catch {}
      }
    }
  }

  const handleTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = typedInput.trim()
    if (!trimmed) return
    const words = trimmed.split(/\s+/)
    processWords(words)
    setTypedInput('')
  }

  // Re-generate blanks with chosen strategy and density
  const handleApplyBlankConfig = (newStrategy: BlankStrategy, newDensity: number) => {
    setStrategy(newStrategy)
    setBlankDensity(newDensity)
    if (fullText) {
      const generated = parseBlanks(fullText, newDensity, newStrategy)
      setTokens(generated)
      onReconfigureBlanks?.(newStrategy, newDensity)
    }
    setIsDrawerOpen(false)
  }

  const currentBlankId = cursor < wordTokens.length && wordTokens[cursor].isBlank
    ? wordTokens[cursor].id
    : null

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg)] relative">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto glass-panel rounded-2xl border border-[var(--color-border)] shadow-sm p-6 md:p-10 leading-[1.9] text-xl sm:text-lg text-[var(--color-text-primary)]">
          {tokens.map((token) => {
            if (!token.isWord) {
              return <span key={token.id}>{token.text}</span>
            }

            if (token.isBlank) {
              const isCorrect = correct.has(token.id) || hasWon
              const isWrong = !isCorrect && wrong.has(token.id)
              const isCurrent = !hasWon && token.id === currentBlankId
              const answer = filled[token.id] || (isCorrect ? token.text : '')

              return (
                <span
                  key={token.id}
                  onClick={() => handleSelectBlank(token.id)}
                  title="Click to start typing or speaking from this blank"
                  className={`
                    inline-flex items-center justify-center mx-1 px-3 py-0.5 rounded-lg
                    border-b-2 font-semibold min-w-[3rem] text-center transition-all duration-300 cursor-pointer select-none
                    ${isCorrect
                      ? 'border-[var(--color-know)] text-[var(--color-know)] bg-[var(--color-know)]/15 scale-105 shadow-sm'
                      : isWrong
                        ? `border-[var(--color-dontknow)] text-[var(--color-dontknow)] bg-[var(--color-dontknow)]/15 shadow-[0_0_12px_rgba(244,63,94,0.4)] animate-shake ${isCurrent ? 'ring-2 ring-[var(--color-dontknow)]/60' : ''}`
                        : isCurrent
                          ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/15 ring-2 ring-[var(--color-accent)]/40 animate-pulse'
                          : 'border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-surface-2)] hover:border-[var(--color-accent)]/50'
                    }
                  `}
                >
                  {isCorrect ? (
                    <span className="flex items-center gap-1 font-bold">
                      {answer} <CheckCircle2 size={14} className="inline text-[var(--color-know)] shrink-0" />
                    </span>
                  ) : isWrong ? (
                    <span className="flex items-center gap-1 font-bold">
                      {answer} <XCircle size={14} className="inline text-[var(--color-dontknow)] shrink-0" />
                    </span>
                  ) : isCurrent ? (
                    <span className="min-w-[2rem] text-[var(--color-accent)] font-mono">···</span>
                  ) : (
                    <span className="text-[var(--color-border)]">{'_'.repeat(Math.max(3, token.text.length))}</span>
                  )}
                </span>
              )
            }

            // Regular non-blank word
            const tokenWordIdx = wordTokens.findIndex(w => w.id === token.id)
            const isPassed = tokenWordIdx < cursor
            return (
              <span
                key={token.id}
                className={`transition-opacity duration-200 ${(isPassed && !hasWon && wrong.size === 0) ? 'opacity-40' : 'opacity-100'}`}
              >
                {token.text}
              </span>
            )
          })}
        </div>

        {hasWon && (
          <div className="mt-6 text-center text-[var(--color-know)] font-semibold text-lg flex items-center justify-center gap-2">
            🎉 All blanks filled correctly!
          </div>
        )}
      </div>

      {/* Streamlined Sticky Bottom Bar: Only essential controls, centered & pushed up like True/False buttons */}
      <div className="sticky bottom-0 z-10 shrink-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] px-4 pt-3 pb-[88px] sm:pb-4 flex flex-col items-center gap-2.5">
        {!hasWon && (
          <form onSubmit={handleTypedSubmit} className="w-full max-w-md mx-auto">
            <input
              ref={inputRef}
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder="Type answer and press Enter..."
              className="w-full px-4 py-2.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors text-center"
              autoComplete="off"
            />
          </form>
        )}

        <div className="flex items-center justify-center gap-2.5 w-full max-w-md mx-auto">
          {/* Restart Icon Button */}
          <button
            onClick={handleReset}
            title="Restart from beginning"
            type="button"
            className={`p-3 rounded-xl border border-[var(--color-border)] transition-colors shrink-0 ${
              hasWon
                ? 'bg-[var(--color-accent)] text-white font-semibold shadow-md hover:opacity-95'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]'
            }`}
          >
            <RotateCcw size={18} />
          </button>

          {/* Primary Centered Read Aloud / Listening Button */}
          {!hasWon && (
            <button
              onClick={toggleListening}
              type="button"
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm sm:text-base font-semibold transition-all flex-1 min-w-0 shadow-sm ${
                isListening
                  ? 'bg-[var(--color-know)]/20 text-[var(--color-know)] ring-2 ring-[var(--color-know)]/40 shadow-[0_0_14px_var(--color-know)]'
                  : 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'
              }`}
            >
              {isListening
                ? <Mic size={20} className="animate-pulse shrink-0 text-[var(--color-know)]" />
                : <MicOff size={20} className="shrink-0" />}
              <span className="truncate">{isListening ? 'Listening… speak aloud' : 'Read Aloud'}</span>
            </button>
          )}

          {/* Hidden Drawer Toggle Button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            title="Customize blanks (NLP vs Random)"
            type="button"
            className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors shrink-0"
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {wrong.size > 0 && !hasWon && (
          <span className="text-xs text-[var(--color-dontknow)] font-medium text-center">
            {wrong.size === 1 ? '1 blank is incorrect — tap any blank to speak or type from there' : `${wrong.size} blanks are incorrect — tap any blank to speak or type`}
          </span>
        )}
      </div>

      {/* Hidden Drawer: Slide-over / Modal for Blank Mode & Density */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className="glass-panel rounded-t-3xl sm:rounded-2xl border border-[var(--color-border)] w-full max-w-md p-5 cyber-border shadow-2xl space-y-5 bg-[var(--color-surface)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-[var(--color-accent)]" />
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">Blank Customization</h3>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Masking Logic / Strategy */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Blank Selection Logic
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyBlankConfig('smart', blankDensity)}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    strategy === 'smart'
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-text-primary)] ring-1 ring-[var(--color-accent)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-[var(--color-text-primary)]">
                    <Sparkles size={14} className="text-[var(--color-accent)]" />
                    <span>Smart Entities</span>
                  </div>
                  <span className="text-[11px] text-[var(--color-text-muted)] leading-tight">
                    Dates, People, Places, Concepts & Nouns
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyBlankConfig('random', blankDensity)}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    strategy === 'random'
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-text-primary)] ring-1 ring-[var(--color-accent)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-[var(--color-text-primary)]">
                    <Shuffle size={14} className="text-[var(--color-accent)]" />
                    <span>Random Blanks</span>
                  </div>
                  <span className="text-[11px] text-[var(--color-text-muted)] leading-tight">
                    Pure randomized word masking
                  </span>
                </button>
              </div>
            </div>

            {/* Blank Density */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Blank Density
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: '15%', density: 0.15 },
                  { label: '25%', density: 0.25 },
                  { label: '35%', density: 0.35 },
                  { label: '50%', density: 0.50 },
                ].map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => handleApplyBlankConfig(strategy, d.density)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all ${
                      blankDensity === d.density
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white shadow-sm'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsDrawerOpen(false)}
              className="w-full py-2.5 bg-[var(--color-surface-3)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-semibold rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
