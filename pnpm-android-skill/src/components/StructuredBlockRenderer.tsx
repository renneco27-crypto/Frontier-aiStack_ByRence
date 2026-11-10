'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import type { BackBlock } from '@/lib/relay/relayTypes'
import MathFormattedText from './MathFormattedText'

/**
 * Strips unbalanced ** markers and completely strips ** inside back_blocks.
 * Also prevents label and content from sharing one bold span.
 */
export function sanitizeBlockString(text: string, stripAllBold: boolean = true): string {
  if (!text) return ''
  let s = String(text)

  if (stripAllBold) {
    return s.replace(/\*\*/g, '').trim()
  }

  // Count ** markers: if odd, remove the trailing one
  const matches = s.match(/\*\*/g)
  if (matches && matches.length % 2 !== 0) {
    const lastIdx = s.lastIndexOf('**')
    s = s.slice(0, lastIdx) + s.slice(lastIdx + 2)
  }

  // Strip empty **** markers
  s = s.replace(/\*\*\s*\*\*/g, '')

  return s.trim()
}

/**
 * Removes redundant card title prefix from block labels (case-insensitive)
 * e.g. "Equal-Frequency Binning Procedure" -> "Procedure"
 */
export function cleanBlockLabel(label: string, cardTitle?: string): string {
  if (!label) return ''
  let clean = sanitizeBlockString(label, true)

  if (cardTitle && cardTitle.trim()) {
    const titleTrimmed = cardTitle.trim()
    const regex = new RegExp(`^${titleTrimmed}[:\\s–-]+`, 'i')
    clean = clean.replace(regex, '').trim()

    // Also check single significant words from title if label starts with it
    const firstWord = titleTrimmed.split(/\s+/)[0]
    if (firstWord && firstWord.length > 4) {
      const wordRegex = new RegExp(`^${firstWord}[:\\s–-]+`, 'i')
      clean = clean.replace(wordRegex, '').trim()
    }
  }

  return clean || label
}

interface StructuredBlockRendererProps {
  blocks: BackBlock[]
  cardTitle?: string
  hideBold?: boolean
}

export default function StructuredBlockRenderer({
  blocks,
  cardTitle,
  hideBold = false,
}: StructuredBlockRendererProps) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null

  const isKeyConcepts = cardTitle ? /key\s*concept/i.test(cardTitle) : false
  let defCounter = 0

  const renderSingleBlock = (block: BackBlock, idx: number) => {
    switch (block.kind) {
      case 'definition': {
        defCounter++
        const rawTerm = sanitizeBlockString(block.term, false).replace(/^\d+[\.\)]\s*/, '').trim()
        const cleanTerm = isKeyConcepts ? `${defCounter}. ${rawTerm}` : rawTerm
        const cleanText = sanitizeBlockString(block.text, false)
        return (
          <div
            key={idx}
            className="rounded-xl p-3.5 sm:p-4 bg-[var(--color-surface-2)]/80 border-l-4 border-l-[var(--color-accent,#ff2d85)] border border-[var(--color-border)] shadow-sm my-2"
          >
            <div className="text-sm sm:text-base leading-[1.6] text-[var(--color-text-primary)]">
              {cleanTerm && (
                <span className="font-bold text-[var(--color-text-primary)] mr-2">
                  <MathFormattedText text={`**${cleanTerm}**`} hideBold={hideBold} />
                </span>
              )}
              <span className="text-[var(--color-text-primary)]">
                <MathFormattedText text={cleanText} hideBold={hideBold} />
              </span>
            </div>
          </div>
        )
      }

      case 'steps': {
        const label = cleanBlockLabel(block.label || 'Procedure', cardTitle)
        const items = Array.isArray(block.items) ? block.items : []
        return (
          <div key={idx} className="space-y-2">
            {label && (
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)] select-none">
                {label}
              </span>
            )}
            <ol className="space-y-2.5">
              {items.map((item: string, itemIdx: number) => (
                <li
                  key={itemIdx}
                  className="flex items-start gap-2.5 text-sm sm:text-[15px] leading-[1.55] text-[var(--color-text-secondary,#cbd5e1)]"
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-accent)] font-semibold text-xs shrink-0 select-none mt-0.5">
                    {itemIdx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <MathFormattedText text={sanitizeBlockString(item, false)} hideBold={hideBold} />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )
      }

      case 'table': {
        const columns = Array.isArray(block.columns) ? block.columns : []
        const rows = Array.isArray(block.rows) ? block.rows : []

        return (
          <div
            key={idx}
            className="overflow-hidden rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-sm select-text w-full my-2.5"
          >
            <div className="overflow-x-auto max-w-full w-full">
              <table className="w-full text-left text-xs sm:text-sm font-normal border-collapse tabular-nums">
                <thead>
                  <tr className="bg-[var(--color-surface-3)] border-b border-[var(--color-border)]">
                    {columns.map((col: string, colIdx: number) => (
                      <th
                        key={colIdx}
                        className={`px-3.5 py-3 sm:px-4 sm:py-3.5 text-[11px] font-bold text-[var(--color-text-primary)] border-r last:border-r-0 border-[var(--color-border)] uppercase tracking-wider ${
                          colIdx === 0 ? 'sticky left-0 bg-[var(--color-surface-3)] z-10' : ''
                        }`}
                      >
                        <MathFormattedText text={col} hideBold={hideBold} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {rows.map((row: string[], rIdx: number) => (
                    <tr
                      key={rIdx}
                      className="even:bg-[var(--color-surface-1)]/40 hover:bg-[var(--color-surface-3)]/40 transition-colors"
                    >
                      {row.map((cell: string, cIdx: number) => (
                        <td
                          key={cIdx}
                          className={`px-3.5 py-3 sm:px-4 sm:py-3.5 text-[var(--color-text-primary)] border-r last:border-r-0 border-[var(--color-border)] text-left ${
                            cIdx === 0 ? 'sticky left-0 bg-[var(--color-surface-2)] z-10 font-semibold' : ''
                          }`}
                        >
                          <MathFormattedText text={sanitizeBlockString(cell, false)} hideBold={hideBold} />
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

      case 'formula': {
        const label = cleanBlockLabel(block.label || 'Formula', cardTitle)
        return (
          <div key={idx} className="space-y-1 my-1">
            {label && (
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)] select-none">
                {label}
              </span>
            )}
            <div className="overflow-x-auto py-2 px-3 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] font-mono text-xs sm:text-sm text-[var(--color-accent)]">
              <MathFormattedText text={block.text} hideBold={hideBold} />
            </div>
          </div>
        )
      }

      case 'example': {
        const label = cleanBlockLabel(block.label || 'Example', cardTitle)
        return (
          <div
            key={idx}
            className="ml-4 pl-3.5 py-2.5 rounded-r-xl border-l-2 border-l-[var(--color-accent,#ff2d85)]/60 bg-[var(--color-surface-2)]/40 min-w-0"
          >
            {label && (
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-accent)] block mb-1">
                {label}
              </span>
            )}
            <div className="text-sm leading-[1.55] text-[var(--color-text-secondary,#cbd5e1)]">
              <MathFormattedText text={sanitizeBlockString(block.text, false)} hideBold={hideBold} />
            </div>
          </div>
        )
      }

      case 'note': {
        return (
          <div key={idx} className="text-sm sm:text-[15px] leading-[1.6] text-[var(--color-text-primary)] py-1 flex items-start gap-2.5 min-w-0">
            <span className="text-[var(--color-accent)] select-none mt-1 shrink-0">•</span>
            <div className="flex-1 min-w-0 break-words">
              <MathFormattedText text={sanitizeBlockString(block.text, false)} hideBold={hideBold} />
            </div>
          </div>
        )
      }

      case 'pros_cons': {
        const label = cleanBlockLabel(block.label || 'Advantages & Disadvantages', cardTitle)
        const pros = Array.isArray(block.pros) ? block.pros : []
        const cons = Array.isArray(block.cons) ? block.cons : []
        return (
          <div key={idx} className="space-y-2 my-2">
            {label && (
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)] select-none">
                {label}
              </span>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {pros.length > 0 && (
                <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-xs font-semibold text-emerald-400 block mb-1.5">Advantages / Pros</span>
                  <ul className="space-y-1 text-xs sm:text-sm text-[var(--color-text-primary)]">
                    {pros.map((p: string, pIdx: number) => (
                      <li key={pIdx} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 mt-0.5">•</span>
                        <div className="flex-1 min-w-0">
                          <MathFormattedText text={sanitizeBlockString(p, false)} hideBold={hideBold} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {cons.length > 0 && (
                <div className="rounded-xl p-3 bg-rose-500/10 border border-rose-500/20">
                  <span className="text-xs font-semibold text-rose-400 block mb-1.5">Disadvantages / Cons</span>
                  <ul className="space-y-1 text-xs sm:text-sm text-[var(--color-text-primary)]">
                    {cons.map((c: string, cIdx: number) => (
                      <li key={cIdx} className="flex items-start gap-1.5">
                        <span className="text-rose-400 mt-0.5">•</span>
                        <div className="flex-1 min-w-0">
                          <MathFormattedText text={sanitizeBlockString(c, false)} hideBold={hideBold} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )
      }

      default:
        return null
    }
  }

  return (
    <div className="space-y-3 sm:space-y-3.5">
      {blocks.map((block, index) => renderSingleBlock(block, index))}
    </div>
  )
}
