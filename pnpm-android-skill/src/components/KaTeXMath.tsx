'use client'

import React, { useMemo } from 'react'
import katex from 'katex'

export function toLatex(raw: string): string {
  if (!raw) return ''

  let tex = raw.trim()

  // If already standard LaTeX containing backslashes, return as-is
  if (tex.includes('\\htmlClass') || tex.includes('\\cancel') || tex.includes('\\frac')) {
    return tex
  }

  // Replace &*(sigma), &*(theta), &*(sqrt{...}), etc.
  tex = tex.replace(/&\*\(([^)]+)\)/g, (_match, token) => {
    const trimmed = token.trim()
    const sqrtMatch = trimmed.match(/^sqrt\{([^}]+)\}$/)
    if (sqrtMatch) return `\\sqrt{${toLatex(sqrtMatch[1])}}`

    const greekMap: Record<string, string> = {
      sigma: '\\sigma', Sigma: '\\Sigma', sum: '\\sum', prod: '\\prod',
      int: '\\int', theta: '\\theta', Theta: '\\Theta', pi: '\\pi',
      alpha: '\\alpha', beta: '\\beta', gamma: '\\gamma', delta: '\\delta',
      mu: '\\mu', phi: '\\phi', lambda: '\\lambda', infty: '\\infty',
      pm: '\\pm', neq: '\\neq', approx: '\\approx', le: '\\le', ge: '\\ge',
      sin: '\\sin', cos: '\\cos', tan: '\\tan', sec: '\\sec', csc: '\\csc',
      cot: '\\cot', log: '\\log', ln: '\\ln', lim: '\\lim',
    }
    if (greekMap[trimmed]) return greekMap[trimmed]
    return trimmed
  })

  // Replace simple &*token
  tex = tex.replace(/&\*([a-zA-Z]+)/g, (_m, token) => `\\${token}`)

  // Replace +- with \pm
  tex = tex.replace(/\+-/g, '\\pm ')

  // Convert (a+b)/(c+d) or a/b into \frac{a+b}{c+d} if not already LaTeX
  if (!tex.includes('\\frac')) {
    tex = tex.replace(/(\([^)]+\)|[a-zA-Z0-9^_+.-]+)\s*\/\s*(\([^)]+\)|[a-zA-Z0-9^_+.-]+)/g, (_m, num, den) => {
      const cleanNum = num.replace(/^\((.+)\)$/, '$1').trim()
      const cleanDen = den.replace(/^\((.+)\)$/, '$1').trim()
      return `\\frac{${cleanNum}}{${cleanDen}}`
    })
  }

  // Replace * with \cdot
  tex = tex.replace(/(?<=[0-9a-zA-Z\)])\s*\*\s*(?=[0-9a-zA-Z\(])/g, ' \\cdot ')

  return tex
}

interface KaTeXMathProps {
  math: string
  displayMode?: boolean
  className?: string
}

export default function KaTeXMath({ math, displayMode = false, className = '' }: KaTeXMathProps) {
  const html = useMemo(() => {
    if (!math) return ''
    const cleanTex = toLatex(math)
    try {
      return katex.renderToString(cleanTex, {
        throwOnError: false,
        displayMode,
        strict: false,
        trust: true,
      })
    } catch {
      return `<span class="font-mono">${cleanTex}</span>`
    }
  }, [math, displayMode])

  return (
    <span
      className={`inline-block select-text align-middle ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
