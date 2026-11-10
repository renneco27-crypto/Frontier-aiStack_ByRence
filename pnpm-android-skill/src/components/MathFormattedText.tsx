'use client'

import React, { useState, useEffect } from 'react'
import { Play, RotateCcw, Copy, Check, ChevronRight } from 'lucide-react'

// Bug 4/5 fix: only treat text as LaTeX when it contains an actual LaTeX command.
// Previously /\\[a-zA-Z]+/ matched "any backslash + letters", so a stray literal \n
// in notes/TF/math text hijacked the entire field into KaTeX (no spaces, italic).
// Also normalize literal "\n" (backslash + n) into a real newline so the rest of
// the renderer can handle it as text.
const LATEX_COMMAND_RE = /\\(frac|sqrt|int|sum|lim|left|right|pi|theta|alpha|beta|gamma|delta|lambda|mu|sigma|omega|phi|psi|rho|tau|cdot|times|div|pm|leq|geq|neq|approx|infty|text|mathbf|mathrm|begin|end|over|binom|partial|nabla|vec|hat|bar|sin|cos|tan|log|ln|exp|cup|cap|in|notin|subset|supset|forall|exists|neg|land|lor|to|rightarrow|leftarrow|Rightarrow|Leftarrow|prime|degree|cancel|quad|qquad|space|hline|underline|overline|mathbb|mathcal|mathfrak)\b/
function isRealLatex(s: string): boolean {
  if (!s) return false
  return LATEX_COMMAND_RE.test(s)
}
function normalizeNewlines(s: any): string {
  if (s === null || s === undefined) return ''
  const str = typeof s === 'string' ? s : String(s)
  return str.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
}
const NON_FRACTION_WORDS = new Set(['and/or', 'true/false', 'yes/no', 'w/o', 'either/or', 'n/a', 'c/o', 'km/h', 'm/s', 'mph'])

const MATH_SYMBOL_MAP: Record<string, string> = {
  sigma: 'σ',
  Sigma: 'Σ',
  sum: '∑',
  prod: '∏',
  int: '∫',
  theta: 'θ',
  Theta: 'Θ',
  pi: 'π',
  Pi: 'Π',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  Gamma: 'Γ',
  delta: 'δ',
  Delta: 'Δ',
  lambda: 'λ',
  Lambda: 'Λ',
  omega: 'ω',
  Omega: 'Ω',
  mu: 'μ',
  phi: 'φ',
  Phi: 'Φ',
  psi: 'ψ',
  rho: 'ρ',
  tau: 'τ',
  infty: '∞',
  infinity: '∞',
  approx: '≈',
  neq: '≠',
  pm: '±',
  le: '≤',
  ge: '≥',
  cdot: '·',
  times: '×',
  div: '÷',
  deg: '°',
  sqrt: '√',
  cos: 'cos',
  sin: 'sin',
  tan: 'tan',
  log: 'log',
  ln: 'ln',
  lim: 'lim',
}

/**
 * Parses and renders custom math directives & symbols:
 * &*(sigma), &*(cos), &*(sqrt{x}), &*(theta), &*(sum), etc.
 */
export function replaceMathSymbols(text: any): string {
  if (text === null || text === undefined) return ''
  const str = typeof text === 'string' ? text : String(text)

  // Replace &*(symbol) or &*symbol or &*(sqrt{content})
  let result = str.replace(/&\*\(([^)]+)\)/g, (_match, token) => {
    const trimmed = token.trim()

    // Handle sqrt{content}
    const sqrtMatch = trimmed.match(/^sqrt\{([^}]+)\}$/)
    if (sqrtMatch) {
      return `√(${sqrtMatch[1]})`
    }

    if (MATH_SYMBOL_MAP[trimmed]) {
      return MATH_SYMBOL_MAP[trimmed]
    }

    // Handle functions like cos(x), sin(2x)
    const funcMatch = trimmed.match(/^(cos|sin|tan|log|ln|lim)(?:\((.*)\))?$/)
    if (funcMatch) {
      const fn = funcMatch[1]
      const arg = funcMatch[2] ? `(${funcMatch[2]})` : ''
      return `${fn}${arg}`
    }

    return trimmed
  })

  // Also replace simple &*token (e.g. &*sigma)
  result = result.replace(/&\*([a-zA-Z]+)/g, (match, token) => {
    return MATH_SYMBOL_MAP[token] || match
  })

  return result
}

import KaTeXMath from './KaTeXMath'

function detectStepOperation(prevStep: string, currStep: string, isFinal: boolean, isFirst: boolean): { type: string; badge: string; color: string } {
  if (isFirst) {
    return { type: 'start', badge: 'Given Expression', color: 'border-blue-500/40 bg-blue-500/10 text-blue-400' }
  }
  if (isFinal) {
    return { type: 'final', badge: '✓ Final Result', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold' }
  }

  const prev = prevStep.toLowerCase()
  const curr = currStep.toLowerCase()

  if (curr.includes('cancel') || prev.includes('cancel') || (prev.includes('/') && !curr.includes('/'))) {
    return { type: 'cancel', badge: '✂ Cancel Terms', color: 'border-red-500/40 bg-red-500/10 text-red-400' }
  }
  if (curr.includes('sqrt') && !prev.includes('sqrt')) {
    return { type: 'root', badge: '√ Square Root', color: 'border-purple-500/40 bg-purple-500/10 text-purple-400' }
  }
  if (curr.includes('pm') || curr.includes('+-')) {
    return { type: 'branch', badge: '± Split Roots', color: 'border-amber-500/40 bg-amber-500/10 text-amber-400' }
  }
  if (curr.includes('=') && prev.includes('=')) {
    const prevParts = prev.split('=')
    const currParts = curr.split('=')
    if (prevParts.length === 2 && currParts.length === 2) {
      if (curr.includes('-') && !prev.includes('-')) {
        return { type: 'sub', badge: '− Subtract from both sides', color: 'border-pink-500/40 bg-pink-500/10 text-pink-400' }
      }
      if (curr.includes('+') && !prev.includes('+')) {
        return { type: 'add', badge: '+ Add to both sides', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' }
      }
      if (curr.includes('/') || curr.includes('\\frac')) {
        return { type: 'div', badge: '÷ Divide both sides', color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400' }
      }
    }
  }
  return { type: 'simplify', badge: 'Simplify Step', color: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400' }
}

/**
 * Interactive Math Step Cancellation Animator Component
 * Renders step-by-step term cancellation with animated red strikethroughs and KaTeX math.
 */
function MathStepAnimator({ stepsRaw }: { stepsRaw: string }) {
  const steps = stepsRaw
    .split(/\s*->\s*|\s*;\s*/)
    .map((s) => s.trim())
    .filter(Boolean)

  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isPlaying) {
      if (currentStep < steps.length - 1) {
        timer = setTimeout(() => {
          setCurrentStep((prev) => prev + 1)
        }, 1400)
      } else {
        setIsPlaying(false)
      }
    }
    return () => clearTimeout(timer)
  }, [isPlaying, currentStep, steps.length])

  if (steps.length === 0) return null

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="my-3 p-4 rounded-2xl bg-[var(--color-surface-2,#111827)] border border-[var(--color-border,rgba(255,255,255,0.08))] shadow-xl select-text"
    >
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-[var(--color-border,rgba(255,255,255,0.08))] text-xs font-semibold text-[var(--color-text-muted,#94a3b8)]">
        <span className="flex items-center gap-1.5 text-[var(--color-accent,#ff2d85)]">
          <span>📐</span> Math Step Solver ({currentStep + 1}/{steps.length})
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (currentStep >= steps.length - 1) {
                setCurrentStep(0)
                setIsPlaying(true)
              } else {
                setIsPlaying(!isPlaying)
              }
            }}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[var(--color-surface-3,#1e293b)] text-white hover:bg-[var(--color-accent,#ff2d85)] transition-all squishy-btn text-xs font-medium"
          >
            {isPlaying ? (
              <span>Pause</span>
            ) : currentStep >= steps.length - 1 ? (
              <>
                <RotateCcw size={12} /> Replay
              </>
            ) : (
              <>
                <Play size={12} /> Play Steps
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {steps.map((step, idx) => {
          const isVisible = idx <= currentStep
          const isLatest = idx === currentStep
          const isFinal = idx === steps.length - 1
          const isFirst = idx === 0
          const op = detectStepOperation(idx > 0 ? steps[idx - 1] : '', step, isFinal, isFirst)

          if (!isVisible) return null

          return (
            <div
              key={idx}
              className={`p-3 rounded-xl transition-all duration-300 ${
                isLatest
                  ? 'bg-[var(--color-surface-1,#0f172a)] border border-[var(--color-accent,#ff2d85)] shadow-lg shadow-pink-950/20 ring-1 ring-[var(--color-accent,#ff2d85)]/20'
                  : 'opacity-70 bg-[var(--color-surface-1,#0f172a)]/40 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono text-[var(--color-text-muted,#94a3b8)]">
                  Step {idx + 1}:
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${op.color}`}>
                  {op.badge}
                </span>
              </div>

              <div className="text-center py-1 overflow-x-auto text-base sm:text-lg">
                <KaTeXMath math={step} displayMode={true} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Excel-Style Responsive Datagrid Table Component
 * Supports:
 * - New format: &[TABLE: H1 ¦ H2 || R1C1 ¦ R1C2 || R2C1 ¦ R2C2]
 * - Markdown tables (| Col 1 | Col 2 |)
 * - Legacy format: &[TABLE: Header1, Header2 | Row1Col1, Row1Col2]
 *   with "last column count wins" heuristic for comma collisions.
 */
function RichTableComponent({ tableRaw, hideBold = false }: { tableRaw: string; hideBold?: boolean }) {
  const [copied, setCopied] = useState(false)
  
  let headerCells: string[] = []
  let rowData: string[][] = []

  // 1. New broken-bar & double-pipe format: &[TABLE: H1 ¦ H2 || R1C1 ¦ R1C2]
  if (tableRaw.includes('||') || tableRaw.includes('¦')) {
    const rawRows = tableRaw.split('||').map((r) => r.trim()).filter(Boolean)
    if (rawRows.length > 0) {
      headerCells = rawRows[0].split('¦').map((c) => c.trim()).filter(Boolean)
      rowData = rawRows.slice(1).map((row) => row.split('¦').map((c) => c.trim()))
    }
  } else if (tableRaw.includes('\n') && tableRaw.includes('|')) {
    // 2. Multi-line markdown table
    const rawLines = tableRaw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const validLines = rawLines.filter(l => !/^[\|\s\-:]+$/.test(l))
    if (validLines.length > 0) {
      headerCells = validLines[0].split('|').map(c => c.trim()).filter(Boolean)
      rowData = validLines.slice(1).map(row => row.split('|').map(c => c.trim()).filter(Boolean))
    }
  } else {
    // 3. Legacy comma-and-pipe format with "last column count wins" heuristic
    const segments = tableRaw.split('|').map((s) => s.trim()).filter(Boolean)
    if (segments.length > 0) {
      headerCells = segments[0].split(',').map((c) => c.trim()).filter(Boolean)
      const expectedColCount = headerCells.length

      rowData = segments.slice(1).map((row) => {
        const parts = row.split(',').map((c) => c.trim())
        if (expectedColCount > 0 && parts.length > expectedColCount) {
          console.warn('[RichTable] Legacy delimiter comma collision detected. Merging trailing cells into last column.')
          const normalCols = parts.slice(0, expectedColCount - 1)
          const lastCol = parts.slice(expectedColCount - 1).join(', ')
          return [...normalCols, lastCol]
        }
        return parts
      })
    }
  }

  if (headerCells.length === 0) return null

  const copyTableData = (e: React.MouseEvent) => {
    e.stopPropagation()
    const jsonLines = [
      headerCells.join(','),
      ...rowData.map((r) => r.join(',')),
    ].join('\n')
    navigator.clipboard.writeText(jsonLines)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="my-2.5 overflow-hidden rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-sm select-text w-full max-w-full font-sans text-xs sm:text-sm font-normal tracking-normal text-left"
    >
      <div className="overflow-x-auto max-w-full w-full">
        <table className="w-full text-left text-xs sm:text-sm font-normal border-collapse tabular-nums">
          <thead>
            <tr className="bg-[var(--color-surface-3)]/60 border-b border-[var(--color-border)]">
              {headerCells.map((h, i) => (
                <th
                  key={i}
                  className={`px-3.5 py-3 sm:px-4 sm:py-3.5 font-bold text-[var(--color-text-primary)] border-r last:border-r-0 border-[var(--color-border)] uppercase tracking-wider text-[11px] ${
                    i === 0 ? 'sticky left-0 bg-[var(--color-surface-2)] z-10' : ''
                  }`}
                >
                  <MathFormattedText text={h} hideBold={hideBold} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rowData.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="hover:bg-[var(--color-surface-3)]/40 transition-colors even:bg-[var(--color-surface-1)]/30"
              >
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className={`px-3.5 py-3 sm:px-4 sm:py-3.5 text-[var(--color-text-secondary,#cbd5e1)] border-r last:border-r-0 border-[var(--color-border)] text-xs sm:text-sm text-left ${
                      cIdx === 0 ? 'sticky left-0 bg-[var(--color-surface-2)] z-10 font-medium' : ''
                    }`}
                  >
                    <MathFormattedText text={cell} hideBold={hideBold} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Parses fractions, superscripts (^), and subscripts (_):
 * - 2/3 -> styled stacked fraction
 * - (2^3) -> (2<sup>3</sup>)
 * - (a+b)/(c-d) -> styled stacked fraction with parsed content
 */
export function formatMathString(text: string): (string | React.ReactElement)[] {
  if (!text) return []

  // Normalize any stray rac{a}{b} into (a)/(b) for stacked fraction rendering
  const withFracs = text.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
  const withSymbols = replaceMathSymbols(withFracs)

  const fracPattern = /(\b\d+\b|\([^)]+\)|[a-zA-Z0-9^_+]+)\s*\/\s*(\b\d+\b|\([^)]+\)|[a-zA-Z0-9^_+]+)/g

  const elements: (string | React.ReactElement)[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let keyIdx = 0

  while ((match = fracPattern.exec(withSymbols)) !== null) {
    const fullMatch = match[0].trim().toLowerCase()

    if (NON_FRACTION_WORDS.has(fullMatch) || fullMatch.includes('http') || fullMatch.includes('//')) {
      continue
    }

    const precedingChar = match.index > 0 ? withSymbols[match.index - 1] : ''
    const followingChar = match.index + match[0].length < withSymbols.length ? withSymbols[match.index + match[0].length] : ''
    if (precedingChar === '/' || followingChar === '/') {
      continue
    }

    const matchIndex = match.index
    if (matchIndex > lastIndex) {
      elements.push(...formatSubSup(withSymbols.substring(lastIndex, matchIndex), `pre-${keyIdx++}`))
    }

    const rawNum = match[1].replace(/^\((.+)\)$/, '$1').trim()
    const rawDenom = match[2].replace(/^\((.+)\)$/, '$1').trim()

    elements.push(
      <span
        key={`frac-${keyIdx++}`}
        className="inline-flex flex-col text-center align-middle mx-1 text-[0.88em] leading-tight select-text inline-block"
        style={{ verticalAlign: 'middle' }}
      >
        <span className="border-b border-[var(--color-border-strong)] pb-[1px] px-1 font-semibold text-[var(--color-text-primary)] leading-none text-center">
          {formatSubSup(rawNum, `num-${keyIdx++}`)}
        </span>
        <span className="pt-[1px] px-1 font-semibold text-[var(--color-text-primary)] leading-none text-center">
          {formatSubSup(rawDenom, `denom-${keyIdx++}`)}
        </span>
      </span>
    )

    lastIndex = matchIndex + match[0].length
  }

  if (lastIndex < withSymbols.length) {
    elements.push(...formatSubSup(withSymbols.substring(lastIndex), `post-${keyIdx++}`))
  }

  return elements
}

function formatSubSup(text: string, prefix: string): (string | React.ReactElement)[] {
  if (!text) return []

  const pattern = /(\^|_)(?:\(([^)]+)\)|([a-zA-Z0-9+\-−.]+))/g
  const elements: (string | React.ReactElement)[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let idx = 0

  while ((match = pattern.exec(text)) !== null) {
    const matchIndex = match.index

    if (matchIndex > lastIndex) {
      elements.push(text.substring(lastIndex, matchIndex))
    }

    const operator = match[1]
    const content = match[2] !== undefined ? match[2] : match[3]

    if (operator === '^') {
      elements.push(
        <sup
          key={`${prefix}-sup-${idx++}`}
          className="text-[0.72em] font-semibold text-[var(--color-accent)] leading-none ml-[0.5px]"
        >
          {content}
        </sup>
      )
    } else if (operator === '_') {
      elements.push(
        <sub
          key={`${prefix}-sub-${idx++}`}
          className="text-[0.72em] font-semibold text-[var(--color-accent)] leading-none ml-[0.5px]"
        >
          {content}
        </sub>
      )
    }

    lastIndex = matchIndex + match[0].length
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex))
  }

  return elements
}

interface MathFormattedTextProps {
  text: string
  className?: string
  hideBold?: boolean
}

function MaskedClozeText({ text }: { text: string }) {
  const [revealed, setRevealed] = useState(false)

  if (revealed) {
    return (
      <span
        onClick={(e) => {
          e.stopPropagation()
          setRevealed(false)
        }}
        className="font-bold text-white bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 px-1.5 py-0.5 rounded cursor-pointer transition-colors shadow-sm"
        title="Click to hide"
      >
        {formatMathString(text)}
      </span>
    )
  }

  return (
    <span
      onClick={(e) => {
        e.stopPropagation()
        setRevealed(true)
      }}
      className="inline-block px-2 py-0.5 rounded bg-[var(--color-surface-3)] text-transparent select-none blur-[5px] hover:blur-none hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer font-bold align-baseline mx-0.5 shadow-sm"
      title="Click or hover to reveal keyword"
    >
      <span className="inline-block">{formatMathString(text)}</span>
    </span>
  )
}

export default function MathFormattedText({
  text,
  className = '',
  hideBold = false,
}: MathFormattedTextProps) {
  if (!text) return null

  // Check for Table Directive: &[TABLE: ...] or &[TABLE ...]
  const tableMatch = text.match(/&\[\s*TABLE\s*:?\s*([\s\S]*?)\]/i)
  if (tableMatch) {
    const beforeTable = text.substring(0, tableMatch.index)
    const tableContent = tableMatch[1]
    const afterTable = text.substring((tableMatch.index || 0) + tableMatch[0].length)

    return (
      <div className={className || 'inline-block w-full'}>
        {beforeTable && <MathFormattedText text={beforeTable} hideBold={hideBold} />}
        <RichTableComponent tableRaw={tableContent} hideBold={hideBold} />
        {afterTable && <MathFormattedText text={afterTable} hideBold={hideBold} />}
      </div>
    )
  }

  // Check for raw markdown tables: | Col1 | Col2 |\n|---|---|\n| Val1 | Val2 |
  const mdTableMatch = text.match(/(?:^|\n)(\|[^\n]+\|\r?\n\|[\s\-:|]+\|\r?\n(?:\|[^\n]+\|(?:\r?\n|$))+)/)
  if (mdTableMatch && mdTableMatch.index !== undefined) {
    const matchIdx = mdTableMatch.index + (mdTableMatch[0].startsWith('\n') ? 1 : 0)
    const tableRaw = mdTableMatch[1].trim()
    const beforeTable = text.substring(0, matchIdx)
    const afterTable = text.substring(matchIdx + tableRaw.length)

    return (
      <div className={className || 'inline-block w-full'}>
        {beforeTable && <MathFormattedText text={beforeTable} hideBold={hideBold} />}
        <RichTableComponent tableRaw={tableRaw} hideBold={hideBold} />
        {afterTable && <MathFormattedText text={afterTable} hideBold={hideBold} />}
      </div>
    )
  }

  // Check for Math Steps Directive: &*(STEPS: ...) or &*(CANCEL: ...) with balanced parentheses
  const findBalancedDirective = (input: string): { start: number; end: number; content: string } | null => {
    const prefixes = ['&*(STEPS:', '&*(CANCEL:']
    for (const prefix of prefixes) {
      const startIdx = input.toUpperCase().indexOf(prefix.toUpperCase())
      if (startIdx !== -1) {
        const contentStart = startIdx + prefix.length
        let depth = 1
        let i = contentStart
        while (i < input.length) {
          if (input[i] === '(') depth++
          else if (input[i] === ')') {
            depth--
            if (depth === 0) {
              return {
                start: startIdx,
                end: i + 1,
                content: input.slice(contentStart, i).trim(),
              }
            }
          }
          i++
        }
        return {
          start: startIdx,
          end: input.length,
          content: input.slice(contentStart).trim(),
        }
      }
    }
    return null
  }

  const stepMatch = findBalancedDirective(text)
  if (stepMatch) {
    const beforeSteps = text.substring(0, stepMatch.start)
    const stepContent = stepMatch.content
    const afterSteps = text.substring(stepMatch.end)

    return (
      <div className={className || 'inline-block w-full'}>
        {beforeSteps && <MathFormattedText text={beforeSteps} hideBold={hideBold} />}
        <MathStepAnimator stepsRaw={stepContent} />
        {afterSteps && <MathFormattedText text={afterSteps} hideBold={hideBold} />}
      </div>
    )
  }

  // Regex to detect inline math expressions like $...$, \(...\), \[...\], \frac{...}{...}, or standalone LaTeX symbols
  const INLINE_MATH_RE = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\[[\s\S]*?\\\]|\\\([^\n]*?\\\)|\\frac\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\\(?:sqrt|sum|int|lim|vec|hat|alpha|beta|gamma|delta|lambda|mu|pi|theta|sigma|omega|phi|approx|neq|pm|leq|geq|times|cdot|div)\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\\(?:frac|sqrt|sum|int|lim|vec|hat|alpha|beta|gamma|delta|lambda|mu|pi|theta|sigma|omega|phi|approx|neq|pm|leq|geq|times|cdot|div)(?=[^a-zA-Z]|$))/g

  const renderChunkWithMath = (chunk: string, prefix: string): (string | React.ReactElement)[] => {
    if (!chunk) return []
    // If the chunk has no real LaTeX tokens, format cleanly as text
    if (!INLINE_MATH_RE.test(chunk)) {
      return [
        <React.Fragment key={`${prefix}-plain`}>
          {formatMathString(normalizeNewlines(chunk))}
        </React.Fragment>
      ]
    }

    INLINE_MATH_RE.lastIndex = 0
    const subParts: (string | React.ReactElement)[] = []
    let subLastIndex = 0
    let m: RegExpExecArray | null
    let subIdx = 0

    while ((m = INLINE_MATH_RE.exec(chunk)) !== null) {
      if (m.index > subLastIndex) {
        const prose = chunk.substring(subLastIndex, m.index)
        subParts.push(
          <React.Fragment key={`${prefix}-p-${subIdx++}`}>
            {formatMathString(normalizeNewlines(prose))}
          </React.Fragment>
        )
      }

      const mathExpr = m[0]
      const cleanMath = mathExpr
        .replace(/^\$\$|\$\$$|^\\\[|\\\]$/g, '')
        .replace(/^\$|\$$|^\\\(|\\\)$/g, '')
        .trim()

      subParts.push(
        <KaTeXMath key={`${prefix}-m-${subIdx++}`} math={cleanMath} />
      )

      subLastIndex = m.index + m[0].length
    }

    if (subLastIndex < chunk.length) {
      const remainingProse = chunk.substring(subLastIndex)
      subParts.push(
        <React.Fragment key={`${prefix}-p-${subIdx++}`}>
          {formatMathString(normalizeNewlines(remainingProse))}
        </React.Fragment>
      )
    }

    return subParts
  }

  // Bold Sanitizer:
  // 1. Strip unbalanced ** markers (if odd count, remove the trailing one)
  // 2. Strip empty **** markers
  // 3. Cleanly unrender literal ** markers so they never show up raw in cards
  let cleanText = text
  const starMatches = cleanText.match(/\*\*/g)
  if (starMatches && starMatches.length % 2 !== 0) {
    const lastStarIdx = cleanText.lastIndexOf('**')
    cleanText = cleanText.slice(0, lastStarIdx) + cleanText.slice(lastStarIdx + 2)
  }
  cleanText = cleanText.replace(/\*\*\s*\*\*/g, '')

  // Check for bold markdown **bold text**, *bold text*, or <b>bold text</b>
  const boldPattern = /\*\*([^*]+)\*\*|\*([^*\n]+)\*|<b>([^<]+)<\/b>/g

  if (!boldPattern.test(cleanText)) {
    return <span className={className || 'inline whitespace-pre-wrap'}>{renderChunkWithMath(cleanText, 'single')}</span>
  }

  boldPattern.lastIndex = 0
  const parts: (string | React.ReactElement)[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let partIdx = 0

  while ((match = boldPattern.exec(cleanText)) !== null) {
    const matchIndex = match.index
    if (matchIndex > lastIndex) {
      const normalChunk = cleanText.substring(lastIndex, matchIndex)
      parts.push(
        <React.Fragment key={`norm-${partIdx++}`}>
          {renderChunkWithMath(normalChunk, `n-${partIdx}`)}
        </React.Fragment>
      )
    }

    const boldContent = (match[1] || match[2] || match[3] || '').trim()

    if (hideBold) {
      parts.push(
        <MaskedClozeText key={`cloze-${partIdx++}`} text={boldContent} />
      )
    } else {
      parts.push(
        <strong
          key={`bold-${partIdx++}`}
          className="font-bold text-[var(--color-text-primary)]"
        >
          {renderChunkWithMath(boldContent, `b-${partIdx}`)}
        </strong>
      )
    }

    lastIndex = matchIndex + match[0].length
  }

  // Use cleanText (not text): indices above were computed against the sanitized string
  if (lastIndex < cleanText.length) {
    const remainingChunk = cleanText.substring(lastIndex)
    parts.push(
      <React.Fragment key={`norm-${partIdx++}`}>
        {renderChunkWithMath(remainingChunk, `end-${partIdx}`)}
      </React.Fragment>
    )
  }

  return <span className={className || 'inline whitespace-pre-wrap'}>{parts}</span>
}
