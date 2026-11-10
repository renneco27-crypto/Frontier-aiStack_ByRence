'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Calculator, Play, Pause, RotateCcw, ChevronRight, ChevronLeft,
  ArrowLeft, ChevronDown, BookOpen, Sparkles, Check,
  CheckCircle2, AlertCircle, Layers, Volume2, VolumeX
} from 'lucide-react'
import KaTeXMath from '@/components/KaTeXMath'
function hasProse(text: string): boolean {
  return /[a-zA-Z]{4,}/.test(text)
}
import MathFormattedText from '@/components/MathFormattedText'
import confetti from 'canvas-confetti'
import { PRELOADED_MATH_CHALLENGES, MathChallenge, MathStep } from './preloadedMathDeck'
import type { Card } from '@/lib/zodSchemas'
import AIPracticeDrawer from '@/components/AIPracticeDrawer'
import { useScrolledTopSpacing } from '@/hooks/useScrolledTopSpacing'
import { useTTS } from '@/hooks/useTTS'

interface MathLabViewProps {
  deckTitle?: string
  onBack?: () => void
  cards?: Card[]
  deckId?: string
}

export function parseMathChallenges(cards?: Card[]): MathChallenge[] {
  if (!cards || cards.length === 0) return []
  const parsed: MathChallenge[] = []

  cards.forEach((c, i) => {
    const isMathType = c.type === 'math' || c.type === 'math_problem'
    const legacyTag  = c.front.includes('&*(') || c.back.includes('&*(')
    if (!isMathType && !legacyTag) return

    const topic    = String(c.front || '').replace(/&\*\(/g, '').trim() || 'Math Problem'
    const problem  = String(c.math_problem || topic)
    const answer   = String(c.math_answer || c.back || problem).replace(/&\*\(/g, '').trim() || problem
    const category = (c.math_category   || 'Algebra') as MathChallenge['category']
    const difficulty = (c.math_difficulty || 'Intermediate') as MathChallenge['difficulty']

    const rawSteps: string = c.math_steps || ''
    let steps: MathStep[] = []

    if (rawSteps.trim()) {
      steps = rawSteps.split(';').map((chunk, idx) => {
        const parts = chunk.split('|').map(p => p.trim())
        const cleanLatex = (parts[0] || problem)
          .replace(/[\x0C\u000c]rac(?=\{)/g, '\\frac')
          .replace(/(^|[^a-zA-Z\\])rac(?=\{)/g, '$1\\frac')
          .replace(/[\x09\t]imes(?=\b|[^a-zA-Z])/g, '\\times')
          .replace(/[\x09\t]ext(?=\{)/g, '\\text')
          .replace(/[\x08\b]eta(?=\b|[^a-zA-Z])/g, '\\beta')
        return {
          stepNumber:     idx + 1,
          latex:          cleanLatex,
          explanation:    parts[1] || (idx === 0 ? 'Given expression.' : `Step ${idx + 1}`),
          operationType:  (parts[2] || (idx === 0 ? 'start' : 'simplify')) as MathStep['operationType'],
          operationBadge: parts[3] || undefined,
        }
      })
    }

    if (steps.length === 0) {
      steps = [
        { stepNumber: 1, latex: problem, explanation: 'Given expression.', operationType: 'start', operationBadge: 'Start' },
        { stepNumber: 2, latex: answer,  explanation: 'Final answer.',      operationType: 'final', operationBadge: 'Answer' },
      ]
    }

    const correctOption = { textLatex: answer, isCorrect: true, explanation: 'Correct final answer.' }
    const dummyOptions = [
      { textLatex: '0',    isCorrect: false, explanation: 'Incorrect.' },
      { textLatex: '1',    isCorrect: false, explanation: 'Incorrect.' },
      { textLatex: 'None', isCorrect: false, explanation: 'Incorrect.' },
    ]

    let parsedNotebook: MathChallenge['notebookData'] = undefined
    if ((c as any).notebook_data) {
      try {
        parsedNotebook = typeof (c as any).notebook_data === 'string' ? JSON.parse((c as any).notebook_data) : (c as any).notebook_data
      } catch {}
    }

    const backNotes = String(c.back || '').replace(/&\*\(/g, '').trim()
    const synthesizedStepsText = steps
      .map((s) => `Step ${s.stepNumber} (${s.operationBadge || s.operationType}): ${s.latex}\n  → ${s.explanation}`)
      .join('\n\n')

    // Guard against "[object Object]" string corruption or missing breakdown
    const rawPb = parsedNotebook?.problem_breakdown as any
    const pb = (rawPb && typeof rawPb === 'object' && !Array.isArray(rawPb))
      ? rawPb
      : undefined

    const pp = parsedNotebook?.practice_problem

    // Clean restatement: NEVER synthesize "Solve for the target quantity in:"
    const resolvedRestate = (() => {
      if (pb?.restate && typeof pb.restate === 'string' && pb.restate !== '[object Object]' && !pb.restate.startsWith('Solve for the target quantity in:')) {
        return pb.restate
      }
      if (pp?.question && typeof pp.question === 'string') {
        return pp.question
      }
      if (backNotes && backNotes !== answer && backNotes.length > 15) {
        return backNotes
      }
      return `Calculate and evaluate the mathematical relationship for ${topic}.`
    })()

    // Clean given values: NEVER synthesize ["Formula for...", "Target Result:..."]
    const resolvedGiven = (() => {
      if (Array.isArray(pb?.given) && pb.given.length > 0) {
        return pb.given.map(String).filter((s: string) => s && s !== '[object Object]')
      }
      if (typeof pb?.given === 'string' && pb.given.trim() && pb.given !== '[object Object]') {
        return pb.given.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean)
      }
      if (Array.isArray(pp?.given) && pp.given.length > 0) {
        return pp.given.map(String)
      }
      return []
    })()

    const resolvedFormulaMaster = (() => {
      if (pb?.formula_master && typeof pb.formula_master === 'string' && pb.formula_master !== '[object Object]') {
        return hasProse(pb.formula_master) ? '' : pb.formula_master
      }
      if (c.math_problem && typeof c.math_problem === 'string' && !hasProse(c.math_problem) && c.math_problem !== topic) {
        return c.math_problem
      }
      if (steps[0]?.latex && !hasProse(steps[0].latex) && steps[0].latex !== topic) {
        return steps[0].latex
      }
      return ''
    })()

    const resolvedFormulaWorking = (() => {
      if (pb?.formula_working && typeof pb.formula_working === 'string' && pb.formula_working !== '[object Object]') {
        return hasProse(pb.formula_working) ? '' : pb.formula_working
      }
      return steps.length > 1 && !hasProse(steps[1]?.latex) ? steps[1]?.latex : ''
    })()

    const notebookData: NonNullable<MathChallenge['notebookData']> = {
      in_plain_words:
        parsedNotebook?.in_plain_words ||
        (backNotes && backNotes !== answer
          ? backNotes
          : `Understand how to set up and solve "${topic}" step-by-step using its core relationship and given values.`),
      problem_breakdown: {
        restate: resolvedRestate,
        given: resolvedGiven,
        formula_master: resolvedFormulaMaster,
        formula_working: resolvedFormulaWorking,
      },
      symbol_table:
        parsedNotebook?.symbol_table && parsedNotebook.symbol_table.length > 0
          ? parsedNotebook.symbol_table
          : undefined,
      solution_steps:
        parsedNotebook?.solution_steps || synthesizedStepsText,
      key_takeaway:
        parsedNotebook?.key_takeaway ||
        `Verified final result: ${answer}`,
      practice_problem: parsedNotebook?.practice_problem,
    }

    const numericPart = parseFloat(String(answer).replace(/[^0-9.-]/g, '')) || 0
    const unitPart = String(answer).replace(/[0-9.\s-]/g, '') || 'J'
    const practiceProblem = notebookData?.practice_problem || {
      question: `Calculate the verified answer with SI unit for: ${problem}`,
      given: [],
      formulaHint: notebookData?.problem_breakdown?.formula_working || problem,
      targetNumeric: numericPart,
      unit: unitPart,
      acceptableUnits: [unitPart.toLowerCase(), unitPart.toLowerCase().replace(/[^a-z]/g, '')],
      tolerancePercent: 2,
      explanation: `Calculated solution yields ${answer}.`
    }

    // Ensure Solver "steps" solves the Interactive Practice Problem (not the Notebook reference example)
    if (notebookData?.practice_problem && steps.length > 0) {
      const pp = notebookData.practice_problem
      const lastLatex = steps[steps.length - 1]?.latex || ''
      const targetStr = String(pp.targetNumeric)
      if (!lastLatex.includes(targetStr)) {
        const formulaLatex = steps[0]?.latex || pp.formulaHint || problem
        const rawGiven = Array.isArray(pp.given) ? pp.given : pp.given ? [String(pp.given)] : []
        const substLatex = (String(pp.explanation || ''))
          .split('=')[1]
          ?.trim()
          ?.replace(/\*/g, ' \\times ') || `${formulaLatex} \\quad (${rawGiven.join(', ')})`
        const finalLatex = `${targetStr}\\text{ ${pp.unit || ''}}`
        steps = [
          {
            stepNumber: 1,
            latex: formulaLatex,
            explanation: 'Write the formula for the Interactive Practice Problem.',
            operationType: 'start',
            operationBadge: 'Formula',
          },
          {
            stepNumber: 2,
            latex: substLatex,
            explanation: `Substitute practice values: ${rawGiven.join(', ')}.`,
            operationType: 'substitute',
            operationBadge: 'Substitute',
          },
          {
            stepNumber: 3,
            latex: finalLatex,
            explanation: pp.explanation || `Evaluate to obtain ${targetStr} ${pp.unit}.`,
            operationType: 'final',
            operationBadge: 'Answer',
          },
        ]
      }
    }

    parsed.push({
      id:           c.id || `card-math-${i}`,
      rawCard:      c,
      topic,
      category,
      difficulty,
      problemLatex: problem,
      description:  topic,
      steps,
      notebookData,
      practiceProblem,
      whatsNextQuiz: {
        question: `What is the final answer to: ${problem}?`,
        options:  [correctOption, ...dummyOptions],
      },
      bugHunterQuiz: {
        flawedSteps: [
          { stepNumber: 1, latex: `${problem} + 1 = 0`, hasError: true, errorReason: 'Incorrect manipulation.' },
        ],
        correctStepLatex: answer,
      },
    })
  })

  return parsed
}

export default function MathLabView({ deckTitle = 'Math Lab', onBack, cards, deckId }: MathLabViewProps) {
  const [challenges, setChallenges] = useState<MathChallenge[]>(() => {
    const fromCards = parseMathChallenges(cards)
    if (fromCards.length > 0) return fromCards
    return PRELOADED_MATH_CHALLENGES
  })
  
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed] = useState(2800)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showProblemMenu, setShowProblemMenu] = useState(false)
  const [activeTab, setActiveTab] = useState<'notebook' | 'solver'>('notebook')
  const { status: ttsStatus, speakSingle, stop: stopTTS } = useTTS()
  const [activeSpeakingCard, setActiveSpeakingCard] = useState<string | null>(null)
  const isScrolled = useScrolledTopSpacing(4)

  useEffect(() => {
    return () => {
      stopTTS()
    }
  }, [stopTTS, currentIndex, activeTab])

  useEffect(() => {
    if (ttsStatus === 'idle') {
      setActiveSpeakingCard(null)
    }
  }, [ttsStatus])

  // Physical animation state
  const [, setAnimState] = useState<'idle' | 'slashing' | 'colliding' | 'fusing'>('idle')
  const [, setPrevStepLatex] = useState<string>('')

  useEffect(() => {
    const updated = parseMathChallenges(cards)
    if (updated.length > 0) {
      setChallenges(updated)
      setCurrentIndex(0)
      setCurrentStep(0)
    } else if (cards && cards.length > 0) {
      setChallenges([])
      setCurrentIndex(0)
      setCurrentStep(0)
    }
  }, [cards])

  const currentChallenge = challenges[currentIndex] || challenges[0]
  const steps = currentChallenge?.steps || []
  const activeStep: MathStep | undefined = steps[currentStep] || steps[0]



  // Interactive Practice Problem state
  const [practiceInput, setPracticeInput] = useState('')
  const [practiceStatus, setPracticeStatus] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [practiceFeedback, setPracticeFeedback] = useState('')

  const handleCheckPractice = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!currentChallenge) return
    const practice = currentChallenge.practiceProblem || currentChallenge.notebookData?.practice_problem
    if (!practice) return

    const raw = practiceInput.trim()
    if (!raw) {
      setPracticeStatus('wrong')
      setPracticeFeedback(`Please enter your answer with the unit (e.g. ${practice.targetNumeric} ${practice.unit}).`)
      return
    }

    const match = raw.match(/^([+-]?\d+(?:\.\d+)?)\s*(.*)$/)
    if (!match) {
      setPracticeStatus('wrong')
      setPracticeFeedback(`Could not read numeric value. Format example: ${practice.targetNumeric} ${practice.unit}`)
      return
    }

    const numericVal = parseFloat(match[1])
    const rawUnit = (match[2] || '').trim().toLowerCase().replace(/[.,;]/g, '')

    if (practice.unit && !rawUnit) {
      setPracticeStatus('wrong')
      setPracticeFeedback(`Missing unit. Please include "${practice.unit}".`)
      return
    }

    if (practice.unit) {
      const acceptableUnits = (practice.acceptableUnits || [practice.unit.toLowerCase()]).map(u => u.toLowerCase())
      const isUnitCorrect = acceptableUnits.some((u) => u === rawUnit)
      if (!isUnitCorrect) {
        setPracticeStatus('wrong')
        setPracticeFeedback(`Check your unit. Expected "${practice.unit}", got "${match[2]}".`)
        return
      }
    }

    // Nearest 2 decimal places rounding support:
    // e.g. 2.1735 rounded to 2 decimals is 2.17.
    // Accept user input if it matches target rounded to 2 decimals, or within percentage tolerance.
    const userRounded2 = Math.round(numericVal * 100) / 100
    const targetRounded2 = Math.round(practice.targetNumeric * 100) / 100
    const tolerance = (practice.tolerancePercent || 2) / 100
    const allowedDiff = Math.max(Math.abs(practice.targetNumeric) * tolerance, 0.05)
    const isNumericMatch = userRounded2 === targetRounded2 || Math.abs(numericVal - practice.targetNumeric) <= allowedDiff

    if (isNumericMatch) {
      setPracticeStatus('correct')
      setPracticeFeedback(`Verified. Value: ${practice.targetNumeric} ${practice.unit}`)
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#4f8ef7', '#34d399', '#818cf8', '#fbbf24'],
        })
      } catch {}
    } else {
      setPracticeStatus('wrong')
      setPracticeFeedback(`Arithmetic check needed. Hint: ${practice.formulaHint || 'Review the working formula'}.`)
    }
  }

  const handleChallengeChange = (idx: number) => {
    setCurrentIndex(idx)
    setCurrentStep(0)
    setIsPlaying(false)
    setShowProblemMenu(false)
    setAnimState('idle')
    setPracticeInput('')
    setPracticeStatus('idle')
    setPracticeFeedback('')
  }

  const triggerStepTransition = (nextIdx: number) => {
    const nextStep = steps[nextIdx]
    if (!nextStep || !activeStep) return

    setPrevStepLatex(activeStep.latex)

    if (nextStep.operationType === 'cancel' || (nextStep.cancelledTerms && nextStep.cancelledTerms.length > 0)) {
      setAnimState('slashing')
      setTimeout(() => {
        setCurrentStep(nextIdx)
        setAnimState('fusing')
        setTimeout(() => setAnimState('idle'), 400)
      }, 500)
    } else if (nextStep.operationType === 'add_sub' || nextStep.operationType === 'mul_div' || nextStep.operationType === 'simplify') {
      setAnimState('colliding')
      setTimeout(() => {
        setCurrentStep(nextIdx)
        setAnimState('fusing')
        setTimeout(() => setAnimState('idle'), 400)
      }, 450)
    } else {
      setCurrentStep(nextIdx)
      setAnimState('fusing')
      setTimeout(() => setAnimState('idle'), 300)
    }
  }

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isPlaying) {
      timer = setInterval(() => {
        if (currentStep < steps.length - 1) {
          triggerStepTransition(currentStep + 1)
        } else {
          setIsPlaying(false)
        }
      }, playbackSpeed)
    }
    return () => clearInterval(timer)
  }, [isPlaying, currentStep, steps.length, playbackSpeed])

  const handlePrevStep = useCallback(() => {
    setIsPlaying(false)
    if (currentStep > 0) {
      triggerStepTransition(currentStep - 1)
    }
  }, [currentStep])

  const handleNextStep = useCallback(() => {
    setIsPlaying(false)
    if (currentStep < steps.length - 1) {
      triggerStepTransition(currentStep + 1)
    }
  }, [currentStep, steps.length])

  const handleTogglePlay = useCallback(() => {
    if (currentStep >= steps.length - 1) {
      setCurrentStep(0)
      setIsPlaying(true)
    } else {
      setIsPlaying((prev) => !prev)
    }
  }, [currentStep, steps.length])

  const handleReset = useCallback(() => {
    setIsPlaying(false)
    setCurrentStep(0)
    setAnimState('idle')
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNextStep()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrevStep()
      } else if (e.key === ' ') {
        e.preventDefault()
        handleTogglePlay()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNextStep, handlePrevStep, handleTogglePlay])

  if (!currentChallenge || challenges.length === 0 || !activeStep) {
    return (
      <div className="min-h-screen bg-transparent text-[var(--color-text-primary)] font-sans antialiased flex flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--color-border)] glass-panel px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-white transition-colors cursor-pointer"
                title="Back"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <Calculator size={16} className="text-[var(--color-accent)]" />
              <span className="text-sm font-semibold text-white tracking-wide">{deckTitle}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] mb-4">
            <Calculator size={32} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Math Challenges Found</h2>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-md mb-6">
            This deck does not contain cards with type &quot;math&quot; or &quot;math_problem&quot;.
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl bg-[var(--color-surface-2)] text-white font-medium hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] transition-all cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              <span>Back to Deck</span>
            </button>
          )}
        </main>
      </div>
    )
  }

  const notebook = currentChallenge.notebookData
  const practice = currentChallenge.practiceProblem || notebook?.practice_problem

  return (
    <div className="min-h-screen bg-transparent text-[var(--color-text-primary)] font-sans antialiased pb-12">
      {/* ─────────────────────────────────────────────────────────────
          1. STRUCTURED TOP NAVIGATION BAR (FLUID ON MOBILE)
         ───────────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl px-3 sm:px-6 transition-[padding,min-height,box-shadow] duration-200 ease-out flex flex-col justify-end ${
        isScrolled
          ? 'pt-[max(calc(env(safe-area-inset-top,0px)+7px),33px)] pb-2.5 min-h-[71px] sm:pt-2.5 sm:pb-2.5 sm:min-h-0 shadow-md shadow-black/20'
          : 'pt-[max(calc(env(safe-area-inset-top,0px)+7px),17px)] pb-2.5 sm:pt-2.5'
      }`}>
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-2">
          {/* Left: Back & Deck Title (truncate cleanly) */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-white transition-colors cursor-pointer shrink-0"
                title="Back"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <span className="text-sm font-semibold text-white tracking-wide truncate">
              {deckTitle}
            </span>
          </div>

          {/* Center: Tabs Switcher (Notebook / Solver) */}
          <div className="flex items-center bg-[var(--color-surface)] border border-[var(--color-border)] p-0.5 rounded-xl text-xs font-medium shrink-0">
            <button
              onClick={() => setActiveTab('solver')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'solver'
                  ? 'bg-[var(--color-surface-3)] text-white font-semibold shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-white'
              }`}
            >
              <Play size={12} fill={activeTab === 'solver' ? 'currentColor' : 'none'} />
              <span>Solver</span>
            </button>
            <button
              onClick={() => setActiveTab('notebook')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'notebook'
                  ? 'bg-[var(--color-surface-3)] text-white font-semibold shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-white'
              }`}
            >
              <BookOpen size={12} />
              <span>Notebook</span>
            </button>
          </div>

          {/* Right: Problem Stepper & Dropdown */}
          <div className="relative flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleChallengeChange(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-25 text-white transition-colors cursor-pointer"
              title="Previous Problem"
            >
              <ChevronLeft size={15} />
            </button>

            <button
              onClick={() => setShowProblemMenu(!showProblemMenu)}
              className="px-3 py-1.5 rounded-xl border border-[var(--color-border-strong)] bg-neutral-900/95 dark:bg-neutral-950 text-xs font-semibold text-white flex items-center gap-1.5 shadow-md hover:bg-neutral-800 transition-all cursor-pointer"
            >
              <span className="font-mono text-white font-bold">{currentIndex + 1}/{challenges.length}</span>
              <ChevronDown size={14} className={`text-neutral-300 transition-transform ${showProblemMenu ? 'rotate-180' : ''}`} />
            </button>

            <button
              onClick={() => handleChallengeChange(Math.min(challenges.length - 1, currentIndex + 1))}
              disabled={currentIndex === challenges.length - 1}
              className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-25 text-white transition-colors cursor-pointer"
              title="Next Problem"
            >
              <ChevronRight size={15} />
            </button>

            {showProblemMenu && (
              <div className="absolute top-full right-0 mt-2 w-72 max-h-80 overflow-y-auto bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-neutral-400 font-semibold border-b border-neutral-800">
                  Select Problem ({challenges.length})
                </div>
                {challenges.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => handleChallengeChange(i)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors my-0.5 cursor-pointer ${
                      currentIndex === i
                        ? 'bg-[var(--color-surface-3)] text-white font-semibold border border-[var(--color-border)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-[10px] text-[var(--color-text-muted)] shrink-0">#{i + 1}</span>
                      <span className="truncate">{c.topic}</span>
                    </div>
                    {currentIndex === i && <Check size={13} className="text-[var(--color-accent)] shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. WORKSPACE CONTENT AREA (GLASS MORPHIC & MOBILE FLUID)
         ───────────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
        
        {/* Challenge Topic Title (clean, no clutter) */}
        <div className="mb-5">
          <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight break-words">
            {currentChallenge.topic}
          </h1>
        </div>

        {/* Studio View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* SOLVER COLUMN (Default / Prioritized): Interactive Practice Problem FIRST, then Solution */}
          <div className={`space-y-5 ${activeTab === 'solver' ? 'block' : 'hidden lg:block'} lg:col-span-6`}>
            
            {/* 1. INTERACTIVE PRACTICE PROBLEM (FIRST) */}
            {practice && (
              <div className="glass-panel rounded-2xl border border-[var(--color-border)] p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)] mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-[var(--color-accent)]" />
                    <h3 className="text-sm font-semibold text-white">Interactive Practice Problem</h3>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border border-[var(--color-border)] font-semibold">
                    SI Unit Check
                  </span>
                </div>

                <div className="text-sm text-slate-200 font-medium leading-relaxed mb-3">
                  <MathFormattedText text={practice.question} />
                </div>

                {practice.given && practice.given.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {practice.given.map((g, gIdx) => (
                      <span key={gIdx} className="px-2.5 py-1 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-text-secondary)]">
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                <form onSubmit={handleCheckPractice} className="space-y-3">
                  <div className="flex flex-row items-center gap-2 min-w-0">
                    <input
                      type="text"
                      value={practiceInput}
                      onChange={(e) => {
                        setPracticeInput(e.target.value)
                        if (practiceStatus !== 'idle') setPracticeStatus('idle')
                      }}
                      placeholder={`e.g., ${practice.targetNumeric} ${practice.unit}`}
                      className={`flex-1 min-w-0 bg-[var(--color-surface)] border rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-white placeholder-[var(--color-text-muted)] focus:outline-none transition-all ${
                        practiceStatus === 'correct'
                          ? 'border-[var(--color-know)]'
                          : practiceStatus === 'wrong'
                          ? 'border-[var(--color-dontknow)]'
                          : 'border-[var(--color-border)] focus:border-[var(--color-accent)]'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={!practiceInput.trim()}
                      className="h-10 px-5 rounded-[12px] bg-[#7e57ff] border-2 border-[#9d7eff] shadow-[0px_3px_0px_0px_#4c2fb3] disabled:opacity-40 text-white text-[13px] font-extrabold tactile-btn cursor-pointer shrink-0"
                    >
                      Verify
                    </button>
                  </div>

                  {practiceFeedback && (
                    <div className={`p-3 rounded-xl text-xs font-sans leading-relaxed border ${
                      practiceStatus === 'correct'
                        ? 'bg-[var(--color-know-soft)] border-[var(--color-know)] text-emerald-200'
                        : 'bg-[var(--color-dontknow-soft)] border-[var(--color-dontknow)] text-rose-200'
                    }`}>
                      <div className="font-semibold mb-1 flex items-center gap-1.5">
                        {practiceStatus === 'correct' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                        {practiceStatus === 'correct' ? 'Correct Verification' : 'Verification Needed'}
                      </div>
                      <div>{practiceFeedback}</div>
                      {practiceStatus === 'correct' && practice.explanation && (
                        <div className="mt-2 pt-2 border-t border-[var(--color-border)] font-mono text-xs text-emerald-300">
                          {practice.explanation}
                        </div>
                      )}
                    </div>
                  )}
                </form>
              </div>
            )}

            {/* 2. SOLUTION (Step-by-Step Solver with Embedded Playback Dock) */}
            <div className="glass-panel rounded-2xl border border-[var(--color-border)] p-5 sm:p-6 shadow-sm">
              
              {/* Solution Card Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)] mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">Solution</h3>
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">
                    Step <strong className="text-white">{currentStep + 1}</strong> of {steps.length}
                  </span>
                </div>
                {activeStep.operationBadge && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                    {activeStep.operationBadge}
                  </span>
                )}
              </div>

              {/* Equation Canvas with Physics Animations */}
              <div className="py-7 text-center overflow-x-auto min-h-[130px] flex items-center justify-center bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] my-2 px-3">
                <style>{`
                  .term-slash {
                    position: relative;
                    display: inline-block;
                    color: #fda4af !important;
                    transition: all 0.3s ease;
                  }
                  .term-slash::after {
                    content: '';
                    position: absolute;
                    top: 50%;
                    left: -3px;
                    right: -3px;
                    height: 2px;
                    background: #f43f5e;
                    transform: rotate(-18deg);
                    animation: laserSlashSweep 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                  }
                  @keyframes laserSlashSweep {
                    0% { width: 0; opacity: 0; }
                    100% { width: 100%; opacity: 1; }
                  }
                `}</style>

                <div className="text-white font-serif tracking-wide transition-all duration-300">
                  {/[\\^_{}$]/.test(activeStep.latex) || /(?:frac|sqrt|cdot|times|pm)\b/.test(activeStep.latex) || /[\x0C\u000c]/.test(activeStep.latex) ? (
                    <span className="text-xl sm:text-2xl md:text-3xl">
                      <KaTeXMath math={activeStep.latex} displayMode={true} />
                    </span>
                  ) : (
                    <span className="font-serif text-lg sm:text-xl md:text-2xl">{activeStep.latex}</span>
                  )}
                </div>
              </div>

              {/* Step Explanation */}
              <div className="mt-3.5 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {activeStep.explanation}
                </p>
              </div>

              {/* EMBEDDED PLAYBACK CONTROLS (Directly inside Solution Card) */}
              <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handlePrevStep}
                    disabled={currentStep === 0}
                    className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-white disabled:opacity-25 transition-all cursor-pointer"
                    title="Previous Step"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="h-10 px-5 rounded-[12px] bg-[#7e57ff] border-2 border-[#9d7eff] shadow-[0px_3px_0px_0px_#4c2fb3] text-white font-extrabold text-[13px] flex items-center justify-center gap-1.5 tactile-btn cursor-pointer"
                    title={isPlaying ? 'Pause' : 'Auto Play'}
                  >
                    {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>

                  <button
                    onClick={handleNextStep}
                    disabled={currentStep === steps.length - 1}
                    className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-white disabled:opacity-25 transition-all cursor-pointer"
                    title="Next Step"
                  >
                    <ChevronRight size={16} />
                  </button>

                  <button
                    onClick={handleReset}
                    className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-white transition-all cursor-pointer"
                    title="Reset to Step 1"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                {/* Step Progress Dots */}
                <div className="flex items-center gap-1 overflow-x-auto max-w-[140px] sm:max-w-none">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setIsPlaying(false)
                        triggerStepTransition(i)
                      }}
                      className={`transition-all duration-200 rounded-full cursor-pointer ${
                        currentStep === i
                          ? 'w-4 h-1.5 bg-white'
                          : i < currentStep
                          ? 'w-1.5 h-1.5 bg-[var(--color-text-secondary)]'
                          : 'w-1.5 h-1.5 bg-[var(--color-surface-3)]'
                      }`}
                      title={`Step ${i + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Step Scrubber / Timeline Accordion */}
              <div className="mt-3.5 pt-3 border-t border-[var(--color-border)]">
                <button
                  onClick={() => setShowDrawer(!showDrawer)}
                  className="w-full flex items-center justify-between text-xs text-[var(--color-text-secondary)] hover:text-white transition-colors cursor-pointer py-1"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <Layers size={13} />
                    <span>View All {steps.length} Steps</span>
                  </span>
                  <ChevronDown size={14} className={`transition-transform ${showDrawer ? 'rotate-180' : ''}`} />
                </button>

                {showDrawer && (
                  <div className="mt-3 space-y-1.5 animate-in fade-in duration-150">
                    {steps.map((s, idx) => (
                      <button
                        key={s.stepNumber}
                        onClick={() => {
                          setIsPlaying(false)
                          setCurrentStep(idx)
                        }}
                        className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          currentStep === idx
                            ? 'bg-[var(--color-surface-3)] text-white font-semibold border border-[var(--color-border)]'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-[10px] text-[var(--color-text-muted)]">#{s.stepNumber}</span>
                          <span className="truncate"><KaTeXMath math={s.latex} /></span>
                        </div>
                        {s.operationBadge && (
                          <span className="text-[10px] font-mono text-[var(--color-text-muted)] shrink-0 ml-2">
                            {s.operationBadge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* NOTEBOOK COLUMN: Reference, Formulas & Breakdown */}
          <div className={`space-y-5 ${activeTab === 'notebook' ? 'block' : 'hidden lg:block'} lg:col-span-6`}>
            
            {/* Intuition Box */}
            {notebook?.in_plain_words && (
              <div
                className={`glass-panel rounded-2xl border p-5 transition-all duration-200 ${
                  activeSpeakingCard === 'math_intuition'
                    ? 'border-[var(--color-know)] ring-2 ring-[var(--color-know)]/40 shadow-lg shadow-[var(--color-know)]/10'
                    : 'border-[var(--color-border)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
                    Physical Intuition
                  </span>
                  <button
                    onClick={() => {
                      if (activeSpeakingCard === 'math_intuition') {
                        stopTTS()
                        setActiveSpeakingCard(null)
                      } else {
                        setActiveSpeakingCard('math_intuition')
                        speakSingle(notebook.in_plain_words || '')
                      }
                    }}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      activeSpeakingCard === 'math_intuition'
                        ? 'border-[var(--color-know)] text-[var(--color-know)] bg-[var(--color-know)]/10'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface-2)]'
                    }`}
                    title={activeSpeakingCard === 'math_intuition' ? 'Stop reading' : 'Read intuition'}
                  >
                    {activeSpeakingCard === 'math_intuition' ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {notebook.in_plain_words}
                </p>
              </div>
            )}

            {/* Problem Breakdown & Formulas */}
            {notebook?.problem_breakdown && (
              <div className="glass-panel rounded-2xl border border-[var(--color-border)] p-5 space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
                  Problem Breakdown
                </h3>
                {notebook.problem_breakdown.restate && (
                  <div className="text-sm text-slate-200 leading-relaxed">
                    <MathFormattedText text={notebook.problem_breakdown.restate} />
                  </div>
                )}

                {notebook.problem_breakdown.given && (Array.isArray(notebook.problem_breakdown.given) ? notebook.problem_breakdown.given.length > 0 : Boolean(notebook.problem_breakdown.given)) && (
                  <div>
                    <span className="text-xs text-[var(--color-text-muted)] font-semibold block mb-1.5">Given Values:</span>
                    <div className="flex flex-wrap gap-2">
                      {(Array.isArray(notebook.problem_breakdown.given)
                        ? notebook.problem_breakdown.given
                        : [String(notebook.problem_breakdown.given)]
                      ).map((g, gIdx) => {
                        const cleanG = String(g).replace(/\\text\{([^}]+)\}/g, '$1')
                        return (
                          <span key={gIdx} className="px-2.5 py-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-mono text-slate-200">
                            <MathFormattedText text={String(g)} />
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {(notebook.problem_breakdown.formula_master || notebook.problem_breakdown.formula_working) && (
                  <div className="p-3.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3 text-xs font-mono">
                    {notebook.problem_breakdown.formula_master && (
                      <div>
                        <span className="text-[var(--color-text-muted)] block text-[10px] uppercase mb-1">Master Formula:</span>
                        <div className="text-slate-200 py-0.5 overflow-x-auto text-sm sm:text-base">
                          <KaTeXMath math={notebook.problem_breakdown.formula_master} displayMode={false} />
                        </div>
                      </div>
                    )}
                    {notebook.problem_breakdown.formula_working && (
                      <div className="pt-2 border-t border-[var(--color-border)]">
                        <span className="text-[var(--color-text-muted)] block text-[10px] uppercase mb-1">Working Formula:</span>
                        <div className="text-emerald-300 font-semibold py-0.5 overflow-x-auto text-sm sm:text-base">
                          <KaTeXMath math={notebook.problem_breakdown.formula_working} displayMode={false} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Symbol & Units Reference Table */}
            {notebook?.symbol_table && notebook.symbol_table.length > 0 && (
              <div className="glass-panel rounded-2xl border border-[var(--color-border)] p-5">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-3">
                  Symbol &amp; Unit Cheat Sheet
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)] font-mono">
                        <th className="py-2 px-2.5 font-semibold">Symbol</th>
                        <th className="py-2 px-2.5 font-semibold">Meaning</th>
                        <th className="py-2 px-2.5 font-semibold">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)] font-mono">
                      {notebook.symbol_table.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-white/[0.02]">
                          <td className="py-2 px-2.5 font-bold text-slate-200">{row.symbol}</td>
                          <td className="py-2 px-2.5 font-sans text-slate-300">{row.meaning}</td>
                          <td className="py-2 px-2.5 text-[var(--color-text-muted)]">{row.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Full Algebraic Steps & Final Value */}
            {notebook?.solution_steps && (
              <div className="glass-panel rounded-2xl border border-[var(--color-border)] p-5">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-3">
                  Step-by-Step Algebraic Solution
                </h3>
                <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4 font-mono text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  <MathFormattedText text={Array.isArray(notebook.solution_steps) ? notebook.solution_steps.join('\n\n') : String(notebook.solution_steps)} />
                </div>
                {notebook.key_takeaway && (
                  <div className="mt-3 text-xs text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border)] pt-3 flex items-center justify-between flex-wrap gap-2">
                    <span className="font-semibold text-slate-300">Answer:</span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold text-xs font-mono">
                      {notebook.key_takeaway.replace(/^Verified final result:\s*/i, '').replace(/^Final value:\s*/i, '')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {currentChallenge && (
        <AIPracticeDrawer
          kind="math"
          deckId={deckId || 'math-lab'}
          difficulty={currentChallenge.difficulty || 'Intermediate'}
          currentScreenContext={{
            screen: 'math',
            topic: currentChallenge.topic,
            activeTab,
            problem: currentChallenge.problemLatex || currentChallenge.description,
            problemBreakdown: notebook?.problem_breakdown,
            currentStep,
            totalSteps: steps.length,
            activeStepLatex: activeStep?.latex || '',
            activeStepExplanation: activeStep?.explanation || '',
          }}
        />
      )}
    </div>
  )
}
