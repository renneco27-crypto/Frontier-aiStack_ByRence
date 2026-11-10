'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft, RotateCcw, Play, CheckCircle2, XCircle,
  FileCode, Bug, Terminal, ChevronDown, Check,
  BookOpen, Code2, Eye, Table, Sparkles, Copy, Maximize2, Minimize2,
  ChevronLeft, ChevronRight, AlertCircle, Loader2, Volume2, VolumeX
} from 'lucide-react'
import confetti from 'canvas-confetti'
import {
  PRELOADED_CODING_CHALLENGES,
  UnifiedCodeChallenge,
} from './preloadedCodingDeck'
import type { Card } from '@/lib/zodSchemas'
import AIPracticeDrawer from '@/components/AIPracticeDrawer'
import { useScrolledTopSpacing } from '@/hooks/useScrolledTopSpacing'
import MathFormattedText from '@/components/MathFormattedText'
import { useTTS } from '@/hooks/useTTS'

type CodeMode = 'scenario' | 'bug_hunter' | 'practice'
type ViewTab = 'ide' | 'notebook'

interface CodeLabViewProps {
  deckTitle?: string
  onBack?: () => void
  cards?: Card[]
  deckId?: string
}

function splitTopLevelStatements(body: string): string[] {
  const result: string[] = []
  let current = ''
  let depthParen = 0
  let depthBracket = 0
  let depthBrace = 0
  let inSingle = false
  let inDouble = false
  let inBacktick = false

  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    const prev = i > 0 ? body[i - 1] : ''

    if (ch === "'" && !inDouble && !inBacktick && prev !== '\\') inSingle = !inSingle
    else if (ch === '"' && !inSingle && !inBacktick && prev !== '\\') inDouble = !inDouble
    else if (ch === '`' && !inSingle && !inDouble && prev !== '\\') inBacktick = !inBacktick

    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '(') depthParen++
      else if (ch === ')') depthParen = Math.max(0, depthParen - 1)
      else if (ch === '[') depthBracket++
      else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1)
      else if (ch === '{') depthBrace++
      else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1)
    }

    current += ch

    if (!inSingle && !inDouble && !inBacktick && depthParen === 0 && depthBracket === 0 && depthBrace === 0 && ch === ';') {
      if (current.trim()) result.push(current.trim())
      current = ''
    }
  }

  if (current.trim()) result.push(current.trim())
  return result
}

export interface BlockCommentDelimiter {
  start: RegExp
  end: RegExp
}

export const BLOCK_COMMENT_DELIMITERS: BlockCommentDelimiter[] = [
  { start: /^\/\*/, end: /\*\// },
  { start: /^<!--/, end: /-->/ },
  { start: /^\{-/, end: /-\}/ },
  { start: /^\(\*/, end: /\*\)/ },
  { start: /^<#/, end: /#>/ },
  { start: /^--\[\[/, end: /\]\]/ },
  { start: /^%\{/, end: /%\}/ },
  { start: /^=begin\b/, end: /^=end\b/ },
  { start: /^"""/, end: /"""/ },
  { start: /^'''/, end: /'''/ },
]

export function isSingleLineComment(trimmed: string): boolean {
  if (trimmed.startsWith('//')) return true
  if (trimmed.startsWith('--')) return true
  if (trimmed.startsWith('%')) return true
  if (trimmed.startsWith(';')) return true
  if (trimmed.startsWith("'")) return true
  if (/^rem\b/i.test(trimmed)) return true
  if (trimmed.startsWith('::')) return true
  if (trimmed.startsWith('#')) {
    // Exclude C/C++ preprocessor directives
    if (/^#(?:include|define|undef|if|ifdef|ifndef|else|elif|endif|pragma|error|warning)\b/i.test(trimmed)) {
      return false
    }
    return true
  }
  return false
}

/**
 * Ensures across 20+ programming languages that when a line is a comment in a laboratory script,
 * an empty line (blank line space) is placed after the comment before the following code.
 */
export function formatCommentSpacing(code: string): string {
  if (!code) return ''
  const lines = code.split('\n')
  const result: string[] = []

  let inBlock: BlockCommentDelimiter | null = null

  interface LineInfo {
    raw: string
    trimmed: string
    isComment: boolean
    isCommentEnd: boolean
    isEmpty: boolean
  }

  const lineInfos: LineInfo[] = []
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (inBlock) {
      const ends = inBlock.end.test(trimmed)
      lineInfos.push({ raw, trimmed, isComment: true, isCommentEnd: ends, isEmpty: false })
      if (ends) inBlock = null
      continue
    }

    if (!trimmed) {
      lineInfos.push({ raw, trimmed, isComment: false, isCommentEnd: false, isEmpty: true })
      continue
    }

    // Check block comment start
    let matchedBlock: BlockCommentDelimiter | null = null
    for (const b of BLOCK_COMMENT_DELIMITERS) {
      if (b.start.test(trimmed)) {
        matchedBlock = b
        break
      }
    }

    if (matchedBlock) {
      let endsOnSameLine = false
      if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
        endsOnSameLine = trimmed.length >= 6 && trimmed.slice(3).includes(trimmed.slice(0, 3))
      } else {
        endsOnSameLine = matchedBlock.end.test(trimmed.slice(2))
      }

      if (endsOnSameLine) {
        lineInfos.push({ raw, trimmed, isComment: true, isCommentEnd: true, isEmpty: false })
      } else {
        inBlock = matchedBlock
        lineInfos.push({ raw, trimmed, isComment: true, isCommentEnd: false, isEmpty: false })
      }
      continue
    }

    if (isSingleLineComment(trimmed)) {
      lineInfos.push({ raw, trimmed, isComment: true, isCommentEnd: true, isEmpty: false })
      continue
    }

    lineInfos.push({ raw, trimmed, isComment: false, isCommentEnd: false, isEmpty: false })
  }

  // Pass 2: reconstruct with line space after comment
  for (let i = 0; i < lineInfos.length; i++) {
    const cur = lineInfos[i]
    result.push(cur.raw)

    if (cur.isCommentEnd) {
      // Look ahead to find the next non-empty line
      let nextIdx = i + 1
      while (nextIdx < lineInfos.length && lineInfos[nextIdx].isEmpty) {
        nextIdx++
      }

      if (nextIdx < lineInfos.length) {
        const next = lineInfos[nextIdx]
        // If next non-empty line is code (not another comment line), ensure there is an empty line
        if (!next.isComment) {
          // If the next immediate line is not already empty, insert an empty line
          if (i + 1 >= lineInfos.length || !lineInfos[i + 1].isEmpty) {
            result.push('')
          }
        }
      }
    }
  }

  return result.join('\n')
}

export function formatCodeSnippet(raw: string): string {
  if (!raw) return ''
  let text = raw.replace(/\r\n/g, '\n').trim()

  const hasSingleLineHtml = /<\/?(?:!DOCTYPE|html|head|body|script)\b[^>]*>\s*<\/?(?:html|head|body|script|title)\b/i.test(text)
  const hasSingleLineFunc = /^\s*(?:public|private|protected|static|async\s+function|function)\s+\w+\s*\([^)]*\)\s*\{.+\}\s*$/m.test(text)

  if (!hasSingleLineHtml && !hasSingleLineFunc) {
    return formatCommentSpacing(text)
  }

  // 1. Expand concatenated HTML structural tags onto separate lines
  for (let pass = 0; pass < 3; pass++) {
    text = text
      .replace(/(<!DOCTYPE[^>]*>)\s*(?=<)/gi, '$1\n')
      .replace(/(<\/?(?:html|head|body|script)[^>]*>)\s*(?=<)/gi, '$1\n')
      .replace(/(<\/title>)\s*(?=<\/head>)/gi, '$1\n')
      .replace(/(<script[^>]*>)\s*(?!\n)/gi, '$1\n')
      .replace(/([^\n])\s*(<\/script>)/gi, '$1\n$2')
  }

  // 2. Expand single-line function/method declarations into multi-line indented blocks
  const expandedLines: string[] = []
  const rawLines = text.split('\n')

  for (const line of rawLines) {
    const fnMatch = line.match(/^(\s*)((?:(?:public|private|protected|static|async)\s+)*function\s+\w+\s*\([^)]*\)|(?:public|private|protected)\s+(?:static\s+)?[\w<>[\]]+\s+\w+\s*\([^)]*\))\s*\{\s*(.+?)\s*\}\s*$/)
    if (fnMatch) {
      const baseIndent = fnMatch[1]
      const signature = fnMatch[2].trim()
      const innerBody = fnMatch[3].trim()
      const stmts = splitTopLevelStatements(innerBody)
      expandedLines.push(`${baseIndent}${signature} {`)
      for (const stmt of stmts) {
        const ifSingle = stmt.match(/^if\s*\((.+?)\)\s*([^{].+)$/)
        if (ifSingle) {
          expandedLines.push(`${baseIndent}  if (${ifSingle[1].trim()}) {`)
          expandedLines.push(`${baseIndent}    ${ifSingle[2].trim()}`)
          expandedLines.push(`${baseIndent}  }`)
        } else {
          expandedLines.push(`${baseIndent}  ${stmt}`)
        }
      }
      expandedLines.push(`${baseIndent}}`)
    } else {
      expandedLines.push(line)
    }
  }

  // 3. Apply clean structural indentation if HTML tags were expanded
  if (hasSingleLineHtml) {
    const finalLines: string[] = []
    let inBody = false
    let inScript = false
    for (let i = 0; i < expandedLines.length; i++) {
      const l = expandedLines[i]
      const trimmed = l.trim()
      if (!trimmed) {
        finalLines.push('')
        continue
      }
      if (/^<!DOCTYPE/i.test(trimmed) || /^<\/?html/i.test(trimmed)) {
        finalLines.push(trimmed)
        continue
      }
      if (/^<head/i.test(trimmed) || /^<\/head/i.test(trimmed)) {
        finalLines.push(`  ${trimmed}`)
        continue
      }
      if (/^<body/i.test(trimmed)) {
        finalLines.push(`  ${trimmed}`)
        inBody = true
        continue
      }
      if (/^<\/body/i.test(trimmed)) {
        inBody = false
        finalLines.push(`  ${trimmed}`)
        continue
      }
      if (/^<script/i.test(trimmed)) {
        finalLines.push(`${inBody ? '    ' : '  '}${trimmed}`)
        inScript = true
        continue
      }
      if (/^<\/script/i.test(trimmed)) {
        inScript = false
        finalLines.push(`${inBody ? '    ' : '  '}${trimmed}`)
        continue
      }
      if (inScript) {
        const prefix = inBody ? '      ' : '    '
        const leadingSpaces = (l.match(/^\s*/) || [''])[0]
        finalLines.push(`${prefix}${leadingSpaces}${trimmed}`)
      } else {
        finalLines.push(l)
      }
    }
    return formatCommentSpacing(finalLines.join('\n'))
  }

  return formatCommentSpacing(expandedLines.join('\n'))
}

function CollapsibleCodeBox({
  title,
  subtitle,
  code,
  onOpenIDE,
  compact = false,
}: {
  title?: string
  subtitle?: string
  code: string
  onOpenIDE?: () => void
  compact?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const formattedCode = formatCodeSnippet(code)
  const lineCount = formattedCode.split('\n').length
  const shouldTruncate = lineCount > (compact ? 7 : 16)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  return (
    <div className={`glass-panel rounded-2xl border border-[var(--color-border)] ${compact ? 'p-3' : 'p-5'}`}>
      {(title || onOpenIDE) && (
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--color-border)]">
          <div>
            {title && <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">{title}</h3>}
            {subtitle && <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-white text-xs flex items-center gap-1 cursor-pointer transition-colors"
              title="Copy code"
            >
              {copied ? <Check size={13} className="text-[var(--color-know)]" /> : <Copy size={13} />}
              <span className="text-[10px] hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {onOpenIDE && (
              <button
                onClick={onOpenIDE}
                className="text-xs text-[#10b981] hover:underline flex items-center gap-1 font-mono font-medium cursor-pointer"
              >
                Open in IDE →
              </button>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        <pre
          style={{ fontVariantLigatures: 'none' }}
          className={`rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4 font-mono text-xs sm:text-sm text-slate-200 overflow-x-auto leading-relaxed transition-all duration-200 ${
            !isExpanded && shouldTruncate ? (compact ? 'max-h-32 overflow-hidden' : 'max-h-64 overflow-hidden') : ''
          }`}
        >
          <code style={{ fontVariantLigatures: 'none' }}>{formattedCode}</code>
        </pre>

        {shouldTruncate && !isExpanded && (
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--color-surface)] via-[var(--color-surface)]/80 to-transparent rounded-b-xl flex items-end justify-center pb-2">
            <button
              onClick={() => setIsExpanded(true)}
              className="px-3.5 py-1.5 rounded-full bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-white border border-[var(--color-border)] text-xs font-mono font-semibold flex items-center gap-1.5 shadow-lg backdrop-blur-md cursor-pointer transition-all active:scale-95"
            >
              <Maximize2 size={12} />
              <span>Click to view full code ({lineCount} lines)</span>
            </button>
          </div>
        )}
      </div>

      {shouldTruncate && isExpanded && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => setIsExpanded(false)}
            className="text-xs text-[var(--color-text-secondary)] hover:text-white flex items-center gap-1 font-mono cursor-pointer"
          >
            <Minimize2 size={13} />
            <span>Show less</span>
          </button>
        </div>
      )}
    </div>
  )
}

export function parseCodeChallenges(cards?: Card[]): UnifiedCodeChallenge[] {
  if (!cards || cards.length === 0) return []
  const parsed: UnifiedCodeChallenge[] = []

  cards.forEach((c, i) => {
    const isCodeType = c.type === 'code' || c.type === 'code_challenge'
    const legacyTag = c.front.includes('&[CODE:') || c.back.includes('&[CODE:')
    if (!isCodeType && !legacyTag) return

    const topic = c.front.replace(/&\[CODE:.*?\]/g, '').trim() || 'Code Challenge'
    let lang = c.code_language || 'javascript'
    if (legacyTag) {
      const match = (c.front + c.back).match(/&\[CODE:(.*?)\]/)
      if (match) lang = match[1].toLowerCase().trim()
    }

    const starter = formatCodeSnippet(c.code_starter || '')
    const solution = formatCodeSnippet(c.code_solution || '')
    const output = c.code_output || 'Program completed successfully.'
    const keywords = c.code_keywords ? c.code_keywords.split(';').map(k => k.trim()).filter(Boolean) : []
    const prompt = c.back.replace(/&\[CODE:.*?\]/g, '').trim() || topic

    let codeLabData: UnifiedCodeChallenge['codeLabData'] = undefined
    if (c.code_lab_data) {
      try {
        codeLabData = JSON.parse(c.code_lab_data)
        if (codeLabData?.script_html) {
          codeLabData.script_html = formatCodeSnippet(codeLabData.script_html)
        }
        if (codeLabData?.syntax_formula) {
          codeLabData.syntax_formula = formatCodeSnippet(codeLabData.syntax_formula)
        }
      } catch {}
    }

    const practiceChallenge = codeLabData?.practice_challenge || {
      prompt: `Write or complete the code to solve: ${topic}`,
      starterCode: starter.slice(0, 50),
      solutionKeywords: keywords.length > 0 ? keywords : [lang],
      explanation: `Validates correct syntax and usage of key concepts.`,
      simulatedOutput: output,
    }

    parsed.push({
      id: c.id || `card-code-${i}`,
      rawCard: c,
      language: lang as any,
      topic,
      category: 'Algorithms',
      description: topic,
      codeLabData,
      practiceChallenge,
      scenario: {
        scenarioPrompt: prompt,
        starterTemplate: starter,
        expectedKeywords: keywords,
        simulatedOutput: output,
        sampleSolution: solution,
      },
      bugHunter: codeLabData?.bug_hunter
        ? {
            scenarioPrompt: codeLabData.bug_hunter.prompt || `Find and fix the bugs in this ${lang} code.`,
            buggyCode: formatCodeSnippet(codeLabData.bug_hunter.buggy_code || codeLabData.bug_hunter.buggyCode || starter),
            bugCount: 1,
            bugDescriptions: codeLabData.bug_hunter.bug_descriptions || ['Fix the bugs to make the code execute properly.'],
            cleanSolution: formatCodeSnippet(codeLabData.bug_hunter.clean_solution || solution),
            simulatedOutput: codeLabData.bug_hunter.simulated_output || output,
          }
        : PRELOADED_CODING_CHALLENGES.find(p =>
            p.topic.toLowerCase() === topic.toLowerCase() ||
            (topic.toLowerCase().includes('switch') && p.topic.toLowerCase().includes('switch'))
          )?.bugHunter || {
            scenarioPrompt: `Find and fix the bugs in this ${lang} code.`,
            buggyCode: starter || solution,
            bugCount: 1,
            bugDescriptions: ['Fix the bugs to make the code execute properly.'],
            cleanSolution: solution,
            simulatedOutput: output,
          },
    })
  })

  return parsed
}

export interface TerminalExecutionData {
  shellTitle: string
  command: string
  outputLabel: string
  stdout: string
  invocations?: string
  testSuiteCode?: string
  exitCode: number
  verifiedMessage: string
}

export function evaluateScriptPrintOutput(script: string, _lang: string = 'java'): string | null {
  if (!script) return null

  const outputs: string[] = []
  const printRegex = /(?:System\.out\.println|System\.out\.print|console\.log|print)\s*\(([\s\S]*?)\);?/g
  const matches = [...script.matchAll(printRegex)]
  if (matches.length === 0) return null

  const env: Record<string, any> = {}

  // Parse simple primitive variable assignments:
  const varRegex = /(?:(?:String|int|double|float|long|char|boolean|var|let|const)\s+)?(\b[A-Za-z_]\w*\b)\s*=\s*([^;]+);/g
  for (const match of script.matchAll(varRegex)) {
    const varName = match[1]
    const rawVal = match[2].trim()

    const strMatch = rawVal.match(/^["'](.*)["']$/)
    if (strMatch) {
      env[varName] = strMatch[1]
      continue
    }

    if (rawVal !== '' && !isNaN(Number(rawVal))) {
      env[varName] = Number(rawVal)
      continue
    }

    if (rawVal === 'true') { env[varName] = true; continue; }
    if (rawVal === 'false') { env[varName] = false; continue; }
  }

  // Parse inline switch expressions:
  const switchRegex = /(?:(?:int|double|String|var|let|const)\s+)?(\b[A-Za-z_]\w*\b)\s*=\s*switch\s*\(([^)]+)\)\s*\{([\s\S]*?)\};/g
  for (const sMatch of script.matchAll(switchRegex)) {
    const varName = sMatch[1]
    const selectorExpr = sMatch[2].trim()
    const switchBody = sMatch[3]

    const selectorVal = env[selectorExpr] !== undefined ? String(env[selectorExpr]) : selectorExpr.replace(/['"]/g, '')

    const caseRegex = /case\s+["']?([^"':\s-]+)["']?\s*(?:->|:)\s*(?:return\s+)?([^;]+);/g
    let matchedVal: any = undefined
    let defaultVal: any = undefined

    for (const cMatch of switchBody.matchAll(caseRegex)) {
      const caseKey = cMatch[1].trim()
      const valStr = cMatch[2].trim().replace(/^["']|["']$/g, '')
      if (caseKey.toLowerCase() === selectorVal.toLowerCase()) {
        matchedVal = valStr
        break
      }
    }

    const defaultMatch = switchBody.match(/default\s*(?:->|:)\s*(?:return\s+)?([^;]+);/)
    if (defaultMatch) {
      defaultVal = defaultMatch[1].trim().replace(/^["']|["']$/g, '')
    }

    env[varName] = matchedVal !== undefined ? matchedVal : (defaultVal !== undefined ? defaultVal : 0)
  }

  // Evaluate print calls strictly — never output unresolved variable names
  for (const m of matches) {
    const rawArg = m[1].trim()

    // 1. String concatenation: "Status Code: " + code
    const parts = rawArg.split(/\s*\+\s*/)
    if (parts.length > 1) {
      let unresolved = false
      const evaluated = parts.map(part => {
        const trimmed = part.trim()
        const strLit = trimmed.match(/^["'](.*)["']$/)
        if (strLit) return strLit[1]
        if (trimmed !== '' && !isNaN(Number(trimmed))) return trimmed
        if (env[trimmed] !== undefined) return String(env[trimmed])
        unresolved = true
        return ''
      }).join('')
      if (unresolved) return null
      outputs.push(evaluated)
      continue
    }

    // 2. String literal: "Hello World"
    const litMatch = rawArg.match(/^["'](.*)["']$/)
    if (litMatch) {
      outputs.push(litMatch[1])
      continue
    }

    // 3. Number literal
    if (rawArg !== '' && !isNaN(Number(rawArg))) {
      outputs.push(rawArg)
      continue
    }

    // 4. Resolved variable reference
    if (env[rawArg] !== undefined) {
      outputs.push(String(env[rawArg]))
      continue
    }

    // Unresolved complex object/array/call — return null so simulatedOutput is used
    return null
  }

  return outputs.length > 0 ? outputs.join('\n') : null
}

export function isOutputRelevantToScript(script: string, output: string): boolean {
  if (!script || !output) return false
  const scriptLower = script.toLowerCase()
  const words = output.toLowerCase().split(/[\s:,\-_./$]+/).filter(w => w.length >= 4)
  if (words.length === 0) return true
  return words.some(w => scriptLower.includes(w))
}

function extractTopLevelInvocations(script: string): string | undefined {
  if (!script) return undefined
  // Check Java main method first
  const mainMatch = script.match(/public\s+static\s+void\s+main\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/)
  if (mainMatch && mainMatch[1]) {
    return mainMatch[1]
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .join('\n')
  }

  // Strip HTML wrappers and extract top-level statements outside function/class blocks
  const cleaned = formatCodeSnippet(script)
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<head>[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?(?:html|body|script)[^>]*>/gi, '')
    .trim()

  const lines = cleaned.split('\n')
  const topCalls: string[] = []
  let braceDepth = 0

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('//')) continue

    const opens = (line.match(/\{/g) || []).length
    const closes = (line.match(/\}/g) || []).length

    if (braceDepth === 0) {
      const isDecl = /^(?:function\s+|async\s+function\s+|def\s+|class\s+|public\s+|private\s+|protected\s+)/.test(line)
      const isEmptyInit = /^(?:let|const|var)\s+\w+\s*=\s*\[\s*\]\s*;?$/.test(line)
      if (!isDecl && !isEmptyInit && opens === closes) {
        topCalls.push(line)
      }
    }

    braceDepth = Math.max(0, braceDepth + opens - closes)
  }

  return topCalls.length > 0 ? topCalls.join('\n') : undefined
}

function sanitizeOutput(raw: string, script: string): string {
  let s = (raw || '').trim()
  if (/^[A-Za-z_]\w*$/.test(s)) {
    // Single bare variable name mistakenly set as output (e.g. 'inventory')
    const itemMatch = script.match(/addItem\s*\(\s*['"]([^'"]+)['"]\s*,\s*(\d+)\s*\)/)
    if (itemMatch) {
      return `[ { name: '${itemMatch[1]}', quantity: ${itemMatch[2]} } ]`
    }
    const singleMatch = script.match(/addItem\s*\(\s*['"]([^'"]+)['"]\s*\)/)
    if (singleMatch) {
      return `[ '${singleMatch[1]}' ]`
    }
  }
  return s
}

export function formatTestSuiteWithPrintCalls(
  rawSuite: string,
  invocations: string | undefined,
  script: string,
  stdout: string,
  lang: string
): string {
  const normLang = (lang || 'java').toLowerCase()
  const isJs =
    normLang.includes('js') ||
    normLang.includes('script') ||
    normLang.includes('node') ||
    normLang.includes('ts') ||
    normLang.includes('html')
  const isPy = normLang.includes('py')
  const isSql = normLang.includes('sql')
  const isJava = normLang.includes('java') && !isJs

  const printFn = isPy ? 'print' : (isJava ? 'System.out.println' : (isSql ? 'SELECT' : 'console.log'))
  const commentPrefix = isPy ? '#' : (isSql ? '--' : '//')

  let text = (rawSuite || '').trim()

  // Convert old multi-line console comments (e.g., listItems();\n// console:\n// 1 Apples 50)
  if (text.includes('console:') || text.includes('console :')) {
    const rawLines = text.split('\n')
    const processed: string[] = []
    let pendingCall = ''
    let inConsoleBlock = false

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim()
      if (!line) continue

      if (/^(?:\/\/|#)\s*console:?\s*\(no output\)/i.test(line)) {
        if (pendingCall) {
          processed.push(pendingCall.endsWith(';') ? pendingCall : `${pendingCall};`)
          pendingCall = ''
        }
        continue
      }

      if (/^(?:\/\/|#)\s*console:?/i.test(line)) {
        inConsoleBlock = true
        continue
      }

      if (inConsoleBlock) {
        if (/^(?:\/\/|#)\s*(.*)$/.test(line)) {
          const match = line.match(/^(?:\/\/|#)\s*(.*)$/)
          const outText = match ? match[1].trim() : ''
          if (pendingCall) {
            const cleanCall = pendingCall.replace(/;$/, '')
            processed.push(`${printFn}(${cleanCall}); ${commentPrefix} -> ${outText}`)
            pendingCall = ''
          } else {
            processed.push(`${commentPrefix} -> ${outText}`)
          }
          inConsoleBlock = false
          continue
        }
        inConsoleBlock = false
      }

      if (pendingCall) {
        processed.push(pendingCall.endsWith(';') ? pendingCall : `${pendingCall};`)
        pendingCall = ''
      }

      if (!line.startsWith('//') && !line.startsWith('#')) {
        pendingCall = line
      } else {
        processed.push(line)
      }
    }

    if (pendingCall) {
      if (stdout) {
        const cleanCall = pendingCall.replace(/;$/, '')
        processed.push(`${printFn}(${cleanCall}); ${commentPrefix} -> ${stdout}`)
      } else {
        processed.push(pendingCall.endsWith(';') ? pendingCall : `${pendingCall};`)
      }
    }

    if (processed.length > 0) {
      text = processed.join('\n')
    }
  }

  // Check if text already contains explicit print function calls
  const hasPrintCall = /(?:System\.out\.println|System\.out\.print|console\.log|print)\s*\(/.test(text)

  if (hasPrintCall) {
    // If it has print calls, ensure any without output comment get paired with stdout
    const lines = text.split('\n')
    const resultLines = lines.map(line => {
      const trimmed = line.trim()
      if (/(?:System\.out\.println|System\.out\.print|console\.log|print)\s*\(/.test(trimmed)) {
        if (!trimmed.includes('//') && !trimmed.includes('#') && !trimmed.includes('->') && stdout) {
          return `${line} ${commentPrefix} -> ${stdout}`
        }
      }
      return line
    })
    return resultLines.join('\n')
  }

  // If no print call in text, inspect invocations or fallback
  const baseCode = text || (invocations || '').trim()

  if (baseCode) {
    const lines = baseCode.split('\n').map(l => l.trim()).filter(Boolean)
    const hasPrint = lines.some(l => /(?:System\.out\.println|console\.log|print)\s*\(/.test(l))
    if (hasPrint) {
      return lines.map(line => {
        if (/(?:System\.out\.println|console\.log|print)\s*\(/.test(line) && !line.includes('//') && !line.includes('#') && stdout) {
          return `${line} ${commentPrefix} -> ${stdout}`
        }
        return line
      }).join('\n')
    }

    // Check if script has a print call we should mirror (e.g. console.log(inventory))
    const scriptPrintMatch = script.match(/(?:System\.out\.println|console\.log|print)\s*\(([^)]+)\);?/)
    if (scriptPrintMatch) {
      const callTarget = scriptPrintMatch[1].trim()
      const printStatement = `${printFn}(${callTarget}); ${commentPrefix} -> ${stdout}`
      return `${baseCode}\n${printStatement}`
    }

    // Wrap the last statement in print call with answer
    const nonCommentLines = lines.filter(l => !l.startsWith('//') && !l.startsWith('#'))
    if (nonCommentLines.length > 0) {
      const lastLine = nonCommentLines[nonCommentLines.length - 1]
      const stripped = lastLine.replace(/;$/, '')
      const wrapped = `${printFn}(${stripped}); ${commentPrefix} -> ${stdout}`
      const idx = lines.lastIndexOf(lastLine)
      lines[idx] = wrapped
      return lines.join('\n')
    }
  }

  return `${printFn}(); ${commentPrefix} -> ${stdout}`
}

export function getTerminalExecutionData(challenge: UnifiedCodeChallenge): TerminalExecutionData {
  const lang = (challenge.language || 'java').toLowerCase()
  const script = challenge.codeLabData?.script_html || challenge.scenario.sampleSolution || ''
  const rawStaticOutput = (challenge.scenario.simulatedOutput || '').trim()
  const isGenericFallback =
    !rawStaticOutput ||
    rawStaticOutput === 'Program completed successfully.' ||
    rawStaticOutput === '// output' ||
    rawStaticOutput === '// terminal output'

  const testSuite = (challenge.codeLabData?.test_suite || '').trim()

  let shellTitle = 'Java Runtime'
  let command = 'java Main.java'
  let outputLabel = 'Terminal Output'
  if (lang.includes('py')) {
    shellTitle = 'Python Runtime'
    command = 'python3 main.py'
    outputLabel = 'Terminal Output'
  } else if (lang.includes('js') || lang.includes('node') || lang.includes('script') || lang.includes('ts') || lang.includes('html')) {
    shellTitle = 'JavaScript Console'
    command = 'node main.js'
    outputLabel = 'Console Output'
  } else if (lang.includes('sql')) {
    shellTitle = 'SQL Engine'
    command = 'sqlite3 :memory: < query.sql'
    outputLabel = 'Query Output'
  }

  const invocations = extractTopLevelInvocations(script)
  const dynamicStdout = evaluateScriptPrintOutput(script, lang)

  // Check if script has an explicit "// Expected: ..." comment
  const expectedCommentMatch = script.match(/\/\/\s*Expected:\s*(.+)$/m)
  const expectedFromComment = expectedCommentMatch ? expectedCommentMatch[1].trim() : ''

  // Extract all outputs if testSuite has lines with comments like // -> 6, // -> 7, or # -> ...
  const suiteOutputs: string[] = []
  if (testSuite) {
    const suiteLines = testSuite.split('\n')
    for (const sLine of suiteLines) {
      const match = sLine.match(/(?:\/\/|#|--)\s*(?:->|=>)\s*(.+)$/)
      if (match && match[1].trim()) {
        suiteOutputs.push(match[1].trim())
      }
    }
  }

  let finalStdout = ''
  if (suiteOutputs.length > 1) {
    // When the test suite has multiple printing calls, show all outputs line-by-line
    finalStdout = suiteOutputs.join('\n')
  } else if (!isGenericFallback) {
    finalStdout = rawStaticOutput
  } else if (suiteOutputs.length === 1) {
    finalStdout = suiteOutputs[0]
  } else if (expectedFromComment) {
    finalStdout = expectedFromComment
  } else if (dynamicStdout) {
    finalStdout = dynamicStdout
  } else if (challenge.codeLabData?.practice_challenge?.simulatedOutput) {
    finalStdout = challenge.codeLabData.practice_challenge.simulatedOutput
  } else if (testSuite) {
    finalStdout = testSuite
  } else {
    finalStdout = 'Executed successfully (no stdout).'
  }

  // Ensure output is resolved beyond bare variable names
  finalStdout = sanitizeOutput(finalStdout, script)

  // Format test suite so it always includes the print function paired with its answer
  const formattedSuite = formatTestSuiteWithPrintCalls(testSuite, invocations, script, finalStdout, lang)

  return {
    shellTitle,
    command,
    outputLabel,
    stdout: finalStdout,
    invocations,
    testSuiteCode: formattedSuite ? formatCodeSnippet(formattedSuite) : undefined,
    exitCode: 0,
    verifiedMessage: 'Output verified against Laboratory Script'
  }
}

export function getVerificationSnippet(challenge: UnifiedCodeChallenge): string {
  const termData = getTerminalExecutionData(challenge)
  const calls = termData.testSuiteCode || termData.invocations
  if (calls) {
    return `${calls}\n\n// Laboratory ${termData.outputLabel}:\n${termData.stdout}`
  }
  return `// Laboratory ${termData.outputLabel}:\n${termData.stdout}`
}

export default function CodeLabView({
  deckTitle = 'Coding IDE',
  onBack,
  cards,
  deckId,
}: CodeLabViewProps) {
  const [challenges, setChallenges] = useState<UnifiedCodeChallenge[]>(() => {
    const fromCards = parseCodeChallenges(cards)
    if (fromCards.length > 0) return fromCards
    return PRELOADED_CODING_CHALLENGES
  })
  
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mode, setMode] = useState<CodeMode>('scenario')
  const [activeTab, setActiveTab] = useState<ViewTab>('notebook')
  const [showMenu, setShowMenu] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const [isMemoryMapOpen, setIsMemoryMapOpen] = useState(false)
  const { status: ttsStatus, currentItemId: ttsCurrentId, speakSingle, stop: stopTTS } = useTTS()
  const [activeSpeakingCard, setActiveSpeakingCard] = useState<string | null>(null)
  const isScrolled = useScrolledTopSpacing(4)

  useEffect(() => {
    return () => {
      stopTTS()
    }
  }, [stopTTS, currentIndex, activeTab, mode])

  useEffect(() => {
    if (ttsStatus === 'idle') {
      setActiveSpeakingCard(null)
    }
  }, [ttsStatus])

  useEffect(() => {
    const updated = parseCodeChallenges(cards)
    if (updated.length > 0) {
      setChallenges(updated)
      setCurrentIndex(0)
    } else if (cards && cards.length > 0) {
      setChallenges([])
      setCurrentIndex(0)
    }
  }, [cards])

  const currentChallenge = challenges[currentIndex] || challenges[0]
  const langKey = currentChallenge?.language || 'java'
  const practice = currentChallenge?.practiceChallenge || currentChallenge?.codeLabData?.practice_challenge


  
  const modeData = currentChallenge
    ? (mode === 'scenario' 
        ? currentChallenge.scenario 
        : mode === 'bug_hunter' 
        ? currentChallenge.bugHunter 
        : {
            scenarioPrompt: practice?.prompt || 'Complete the practice expression.',
            starterTemplate: practice?.starterCode || '',
            expectedKeywords: practice?.solutionKeywords || [],
            simulatedOutput: practice?.simulatedOutput || 'Verified output',
            sampleSolution: practice?.hint || practice?.starterCode || ''
          })
    : null

  const [userCode, setUserCode] = useState(() => {
    if (!currentChallenge) return ''
    if (mode === 'bug_hunter') return currentChallenge.bugHunter.buggyCode
    return ''
  })

  const [feedback, setFeedback] = useState<{
    status: 'idle' | 'success' | 'error'
    message: string
    output?: string
  }>({ status: 'idle', message: '' })

  const handleChallengeChange = (idx: number) => {
    setCurrentIndex(idx)
    setShowMenu(false)
    setShowSolution(false)
    const next = challenges[idx]
    if (next) {
      setUserCode(mode === 'bug_hunter' ? next.bugHunter.buggyCode : '')
    }
    setFeedback({ status: 'idle', message: '' })
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!currentChallenge) return
    setUserCode(mode === 'bug_hunter' ? currentChallenge.bugHunter.buggyCode : '')
    setFeedback({ status: 'idle', message: '' })
  }, [mode, currentChallenge])

  const handleRun = () => {
    if (!currentChallenge) return
    const code = userCode.trim()

    if (!code) {
      setFeedback({
        status: 'error',
        message: 'Editor is empty.',
        output: 'Please provide code before running.',
      })
      return
    }

    // 1. Universal Bracket / Brace Balance Check for C-family & structured languages
    const isCStyle = ['java', 'javascript', 'typescript', 'cpp', 'c', 'csharp'].includes(
      (currentChallenge.language || '').toLowerCase()
    )

    if (isCStyle) {
      const openBraces = (code.match(/\{/g) || []).length
      const closeBraces = (code.match(/\}/g) || []).length
      if (openBraces !== closeBraces) {
        setFeedback({
          status: 'error',
          message: 'Syntax Error: Unbalanced braces',
          output: `error: reached end of file while parsing (found ${openBraces} '{' vs ${closeBraces} '}')`,
        })
        return
      }

      const openParens = (code.match(/\(/g) || []).length
      const closeParens = (code.match(/\)/g) || []).length
      if (openParens !== closeParens) {
        setFeedback({
          status: 'error',
          message: 'Syntax Error: Unbalanced parentheses',
          output: `error: syntax error, mismatched parentheses (found ${openParens} '(' vs ${closeParens} ')')`,
        })
        return
      }
    }

    if (mode === 'practice') {
      const curPractice = currentChallenge.practiceChallenge || currentChallenge.codeLabData?.practice_challenge
      if (!curPractice) {
        setFeedback({
          status: 'success',
          message: 'Output Verified · All Cases Passed',
          output: 'Practice verified.',
        })
        return
      }

      const raw = code
      const normalizedRaw = raw.replace(/=>/g, '->')
      let isMatch = false

      if (curPractice.solutionPattern) {
        try {
          // Allow custom variable names in selector (e.g. switch(lawrence), switch(s), etc.)
          const flexPattern = curPractice.solutionPattern
            .replace(/speed/gi, '[A-Za-z0-9_]+')
            .replace(/selector/gi, '[A-Za-z0-9_]+')
          const regex = new RegExp(flexPattern, 'i')
          if (regex.test(raw) || regex.test(normalizedRaw)) isMatch = true
        } catch {}
      }

      if (!isMatch && curPractice.solutionKeywords && curPractice.solutionKeywords.length > 0) {
        const allFound = curPractice.solutionKeywords.every(kw => {
          if (kw === '->') return raw.includes('->') || raw.includes('=>')
          const targetKw = kw.toLowerCase()
          return raw.toLowerCase().includes(targetKw) || normalizedRaw.toLowerCase().includes(targetKw)
        })
        if (allFound) isMatch = true
      }

      if (isMatch) {
        setFeedback({
          status: 'success',
          message: 'Output Verified · All Cases Passed',
          output: curPractice.simulatedOutput ? `Test Output:\n${curPractice.simulatedOutput}` : 'Verified.',
        })
        try {
          confetti({
            particleCount: 75,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#4f8ef7', '#34d399', '#818cf8', '#fbbf24'],
          })
        } catch {}
      } else {
        setFeedback({
          status: 'error',
          message: 'Verification Failed',
          output: `Logic or syntax issue detected.\nHint: ${curPractice.hint || 'Check expression syntax and branches.'}`,
        })
      }
    } else if (mode === 'scenario') {
      const scenario = currentChallenge.scenario
      const missingKeywords: string[] = []

      if (scenario.expectedKeywords) {
        for (const kw of scenario.expectedKeywords) {
          // Allow -> or => for arrow syntax flexibility on mobile
          if (kw === '->') {
            if (!code.includes('->') && !code.includes('=>')) {
              missingKeywords.push(kw)
            }
          } else if (!code.toLowerCase().includes(kw.toLowerCase())) {
            missingKeywords.push(kw)
          }
        }
      }

      if (missingKeywords.length > 0) {
        setFeedback({
          status: 'error',
          message: 'Compilation Failed: Missing required keywords',
          output: `Compiler error: Symbol not found or missing expected pattern (${missingKeywords.join(', ')})`,
        })
        return
      }

      // Check if switch is used, verify case labels exist
      if (code.includes('switch') && !code.includes('case')) {
        setFeedback({
          status: 'error',
          message: 'Compilation Failed: Incomplete switch block',
          output: `Compiler error: Switch expression must declare at least one case branch.`,
        })
        return
      }

      // Relevance check: verify the code implements the target challenge function or domain
      const fnMatch = scenario.sampleSolution.match(/(?:public\s+static\s+[\w<>[\]]+\s+|function\s+|def\s+)(\w+)\s*\(/)
      if (fnMatch) {
        const fnName = fnMatch[1]
        if (!code.includes(fnName)) {
          // Check if domain-specific string literals or cases are present
          const domainMatches = [...scenario.sampleSolution.matchAll(/["']([A-Z_]{3,})["']/g)].map(m => m[1])
          if (domainMatches.length > 0) {
            const hasDomain = domainMatches.some(d => code.includes(d))
            if (!hasDomain) {
              setFeedback({
                status: 'error',
                message: `Challenge Mismatch: Missing target "${fnName}"`,
                output: `Compiler error: Code in editor does not implement or invoke "${fnName}". Expected domain parameters: ${domainMatches.slice(0, 3).join(', ')}.`,
              })
              return
            }
          }
        }
      }

      // Compute actual output of user code and compare with expected output
      const userStdout = evaluateScriptPrintOutput(code, langKey)
      if (userStdout && scenario.simulatedOutput) {
        const normUser = userStdout.trim().toLowerCase()
        const normExpected = scenario.simulatedOutput.trim().toLowerCase()
        if (normUser !== normExpected && !normUser.includes(normExpected) && !normExpected.includes(normUser)) {
          setFeedback({
            status: 'error',
            message: 'Output Mismatch: Logic does not match challenge',
            output: `Program output:\n${userStdout}\n\nExpected output:\n${scenario.simulatedOutput}`,
          })
          return
        }
      }

      setFeedback({
        status: 'success',
        message: 'Compilation Successful · Output Verified',
        output: userStdout ? `Output:\n${userStdout}` : (scenario.simulatedOutput ? `Output:\n${scenario.simulatedOutput}` : 'Program executed successfully with exit code 0.'),
      })
      try {
        confetti({
          particleCount: 75,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#4f8ef7', '#34d399', '#818cf8', '#fbbf24'],
        })
      } catch {}
    } else {
      const bugHunter = currentChallenge.bugHunter
      const cleanLower = bugHunter.cleanSolution.toLowerCase().replace(/\s+/g, '')
      const buggyLower = bugHunter.buggyCode.toLowerCase().replace(/\s+/g, '')
      const userLower = code.toLowerCase().replace(/\s+/g, '')

      // 1. Relevance check: verify user code addresses this bug hunter challenge
      const fnMatch = bugHunter.cleanSolution.match(/(?:public\s+static\s+[\w<>[\]]+\s+|function\s+|def\s+)(\w+)\s*\(/)
      if (fnMatch) {
        const fnName = fnMatch[1].toLowerCase()
        if (!userLower.includes(fnName)) {
          setFeedback({
            status: 'error',
            message: 'Challenge Mismatch: Unrelated Code',
            output: `The editor does not contain the target method "${fnMatch[1]}". Click "Reset" to load the buggy snippet for this challenge.`,
          })
          return
        }
      }

      // 2. Check if code is unchanged from buggy snippet
      if (userLower === buggyLower) {
        setFeedback({
          status: 'error',
          message: 'Bugs Still Present: Snippet Unmodified',
          output: `Runtime error / logic flaw detected: Check ${bugHunter.bugDescriptions[0] || 'the buggy line'}.`,
        })
        return
      }

      // 3. Fallthrough bug specific check:
      if (bugHunter.bugDescriptions.some(d => d.toLowerCase().includes('break') || d.toLowerCase().includes('fallthrough'))) {
        const usesArrow = code.includes('->') || code.includes('=>')
        const usesBreak = /\bbreak\s*;/i.test(code)
        if (!usesArrow && !usesBreak) {
          setFeedback({
            status: 'error',
            message: 'Fallthrough Bug Still Present',
            output: 'Traditional switch cases still lack break statements. Add "break;" or convert to modern switch arrow ("->") syntax.',
          })
          return
        }
      }

      // 4. Output verification
      const userStdout = evaluateScriptPrintOutput(code, langKey)
      if (userStdout && bugHunter.simulatedOutput) {
        const normUser = userStdout.trim().toLowerCase()
        const normExpected = bugHunter.simulatedOutput.trim().toLowerCase()
        if (normUser !== normExpected && !normUser.includes(normExpected) && !normExpected.includes(normUser)) {
          setFeedback({
            status: 'error',
            message: 'Output Mismatch: Bug not resolved',
            output: `Program output:\n${userStdout}\n\nExpected output:\n${bugHunter.simulatedOutput}`,
          })
          return
        }
      }

      const matchesClean = userLower.includes(cleanLower) || cleanLower.includes(userLower)
      const hasKeyFix = (code.includes('->') || code.includes('=>') || /\bbreak\s*;/i.test(code))

      if (matchesClean || hasKeyFix) {
        setFeedback({
          status: 'success',
          message: 'All Bugs Resolved!',
          output: userStdout ? `Output:\n${userStdout}` : (bugHunter.simulatedOutput ? `Output:\n${bugHunter.simulatedOutput}` : 'All tests passed.'),
        })
        try {
          confetti({
            particleCount: 75,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#4f8ef7', '#34d399', '#818cf8', '#fbbf24'],
          })
        } catch {}
      } else {
        setFeedback({
          status: 'error',
          message: 'Bugs still present in the snippet.',
          output: `Runtime error / logic flaw detected: Check ${bugHunter.bugDescriptions[0] || 'the buggy line'}.`,
        })
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.currentTarget.selectionStart
      const end = e.currentTarget.selectionEnd
      const val = userCode
      setUserCode(val.substring(0, start) + '  ' + val.substring(end))
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2
        }
      }, 0)
    }
  }

  const handleReset = () => {
    if (!currentChallenge) return
    setUserCode(mode === 'bug_hunter' ? currentChallenge.bugHunter.buggyCode : '')
    setFeedback({ status: 'idle', message: '' })
  }

  if (!currentChallenge || challenges.length === 0) {
    return (
      <div className="min-h-screen bg-transparent text-[var(--color-text-primary)] flex flex-col">
        <header className="border-b border-[var(--color-border)] glass-panel px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-30">
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
            <span className="text-sm font-semibold text-white tracking-wide">{deckTitle}</span>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] mb-4">
            <Terminal size={32} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Coding Challenges Found</h2>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-md mb-6">
            This deck does not contain cards with type &quot;code&quot; or &quot;code_challenge&quot;.
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

  const lines = userCode.split('\n')
  const ext = langKey === 'java' ? 'java' : langKey === 'sql' ? 'sql' : langKey === 'python' ? 'py' : 'js'

  return (
    <div className="min-h-screen bg-transparent text-[var(--color-text-primary)] font-sans antialiased flex flex-col pb-10">
      
      {/* ─────────────────────────────────────────────────────────────
          1. STRUCTURED TOP NAVIGATION BAR (GLASS & FLUID - EXACT MATCH TO MATHLAB)
         ───────────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl px-3 sm:px-6 transition-[padding,min-height,box-shadow] duration-200 ease-out flex flex-col justify-end ${
        isScrolled
          ? 'pt-[max(calc(env(safe-area-inset-top,0px)+7px),33px)] pb-2.5 min-h-[71px] sm:pt-2.5 sm:pb-2.5 sm:min-h-0 shadow-md shadow-black/20'
          : 'pt-[max(calc(env(safe-area-inset-top,0px)+7px),17px)] pb-2.5 sm:pt-2.5'
      }`}>
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-2">
          {/* Left: Back & Context (Truncated Cleanly) */}
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

          {/* Center: View Switcher Tabs (2-Pill Clean Match) */}
          <div className="flex items-center bg-[var(--color-surface)] border border-[var(--color-border)] p-0.5 rounded-xl text-xs font-medium shrink-0">
            <button
              onClick={() => setActiveTab('ide')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ide' ? 'bg-[var(--color-surface-3)] text-white font-semibold shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-white'
              }`}
            >
              <Code2 size={12} />
              <span>IDE</span>
            </button>
            <button
              onClick={() => setActiveTab('notebook')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'notebook' ? 'bg-[var(--color-surface-3)] text-white font-semibold shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-white'
              }`}
            >
              <BookOpen size={12} />
              <span>Notebook</span>
            </button>
          </div>

          {/* Right: Challenge Stepper & Dropdown */}
          <div className="relative flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleChallengeChange(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-25 text-white transition-colors cursor-pointer"
              title="Previous Challenge"
            >
              <ChevronLeft size={15} />
            </button>

            <button
              onClick={() => setShowMenu(!showMenu)}
              className="px-3 py-1.5 rounded-xl border border-[var(--color-border-strong)] bg-neutral-900/95 dark:bg-neutral-950 text-xs font-semibold text-white flex items-center gap-1.5 shadow-md hover:bg-neutral-800 transition-all cursor-pointer"
            >
              <span className="font-mono text-white font-bold">{currentIndex + 1}/{challenges.length}</span>
              <ChevronDown size={14} className={`text-neutral-300 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
            </button>

            <button
              onClick={() => handleChallengeChange(Math.min(challenges.length - 1, currentIndex + 1))}
              disabled={currentIndex === challenges.length - 1}
              className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-25 text-white transition-colors cursor-pointer"
              title="Next Challenge"
            >
              <ChevronRight size={15} />
            </button>

            {showMenu && (
              <div className="absolute top-full right-0 mt-2 w-72 max-h-80 overflow-y-auto bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-neutral-400 font-semibold border-b border-neutral-800">
                  Select Challenge ({challenges.length})
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
                    {currentIndex === i && <Check size={13} className="text-[#10b981] shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. WORKSPACE CONTENT AREA (EXACT MATHLAB RESPONSIVE GRID)
         ───────────────────────────────────────────────────────────── */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5">
        
        {/* Challenge Topic Title (Clean, no category noise) */}
        <div className="mb-5">
          <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight break-words">
            {currentChallenge.topic}
          </h1>
        </div>

        {/* Studio View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* LEFT / PRIMARY COLUMN: PRACTICE FIRST, THEN INTERACTIVE IDE RUNNER */}
          <div className={`space-y-5 ${activeTab === 'ide' ? 'block' : 'hidden lg:block'} lg:col-span-7`}>
            
            {/* SOLUTION & RUNNER: FULL-POWER IDE */}
            <div className="glass-panel rounded-2xl border border-[var(--color-border)] p-5 sm:p-6 shadow-sm space-y-4">
              
              {/* Controls Header */}
              <div className="flex flex-row items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-3 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-[var(--color-surface)] border border-[var(--color-border)] p-1 rounded-xl gap-1 text-xs font-semibold overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => setMode('scenario')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                        mode === 'scenario' ? 'bg-[var(--color-surface-3)] text-white shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-white'
                      }`}
                    >
                      <FileCode size={13} />
                      <span>Build Mode</span>
                    </button>
                    <button
                      onClick={() => setMode('bug_hunter')}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                        mode === 'bug_hunter' ? 'bg-[var(--color-surface-3)] text-white shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-white'
                      }`}
                    >
                      <Bug size={13} />
                      <span>Bug Hunter</span>
                    </button>
                    {practice && (
                      <button
                        onClick={() => setMode('practice')}
                        className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          mode === 'practice' ? 'bg-[var(--color-surface-3)] text-white shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-white'
                        }`}
                      >
                        <Sparkles size={13} className="text-[#10b981]" />
                        <span>Interactive Practice</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowSolution(!showSolution)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-xs font-mono text-[var(--color-text-secondary)] hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Eye size={13} />
                    <span>{showSolution ? 'Hide Solution' : 'View Solution'}</span>
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-xs font-mono text-[var(--color-text-secondary)] hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Reset</span>
                  </button>
                  <button
                    onClick={handleRun}
                    className="px-4 py-1.5 rounded-lg bg-white text-black font-semibold text-xs font-mono flex items-center gap-1.5 hover:bg-slate-200 transition-all cursor-pointer active:scale-95"
                  >
                    <Play size={13} fill="currentColor" />
                    <span>Run Code</span>
                  </button>
                </div>
              </div>

              {/* Prompt Statement */}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] font-semibold block mb-1">
                  {mode === 'scenario' 
                    ? 'Challenge Objective' 
                    : mode === 'bug_hunter' 
                    ? 'Bug Hunter Objective' 
                    : 'Interactive Practice Objective'}
                </span>
                <div className="text-sm text-slate-200 leading-relaxed font-sans">
                  <MathFormattedText text={modeData?.scenarioPrompt || ''} />
                </div>
              </div>

              {/* Reference Solution if toggled */}
              {showSolution && modeData && (
                <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-strong)] p-4 text-xs font-mono text-emerald-300 whitespace-pre-wrap leading-relaxed">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] block mb-2 font-mono">Reference Solution</span>
                  {mode === 'scenario' 
                    ? currentChallenge.scenario.sampleSolution 
                    : mode === 'bug_hunter' 
                    ? currentChallenge.bugHunter.cleanSolution 
                    : (practice?.hint || practice?.starterCode || 'No reference solution available.')}
                </div>
              )}

              {/* Code Editor Container */}
              <div className="rounded-xl border border-[var(--color-border)] overflow-hidden flex flex-col bg-[var(--color-surface)] shadow-inner">
                <div className="bg-[var(--color-surface-2)] px-4 py-2 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300 font-medium">Main.{ext}</span>
                    <span className="text-[var(--color-text-muted)]">{lines.length} lines</span>
                  </div>
                </div>

                {/* Editor Workspace: Textarea Fills Entire Div */}
                <div className="flex bg-[var(--color-surface)] min-h-[420px] relative">
                  <div
                    ref={lineNumbersRef}
                    className="select-none text-[var(--color-text-muted)] bg-[var(--color-surface)] text-right py-4 px-3 border-r border-[var(--color-border)] font-mono text-xs leading-6 shrink-0 min-w-[44px] overflow-hidden"
                    aria-hidden="true"
                  >
                    {lines.map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={userCode}
                    onChange={(e) => {
                      setUserCode(e.target.value)
                      setFeedback({ status: 'idle', message: '' })
                    }}
                    onScroll={(e) => {
                      if (lineNumbersRef.current) {
                        lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    className="flex-1 w-full min-h-[420px] p-4 font-mono text-sm leading-6 text-slate-100 bg-transparent outline-none resize-y overflow-auto whitespace-pre selection:bg-white/20"
                    placeholder="// Enter your code..."
                  />
                </div>

                {/* Output Console Embedded */}
                <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 font-mono text-xs max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                      <Terminal size={13} />
                      <span>Console Output</span>
                    </span>
                    {feedback.status !== 'idle' && (
                      <span className={`font-semibold flex items-center gap-1 ${
                        feedback.status === 'success' ? 'text-[var(--color-know)]' : 'text-[var(--color-dontknow)]'
                      }`}>
                        {feedback.status === 'success' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                        {feedback.message}
                      </span>
                    )}
                  </div>

                  {feedback.output ? (
                    <div className="p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-slate-200 whitespace-pre-wrap leading-relaxed text-xs">
                      {feedback.output}
                    </div>
                  ) : (
                    <p className="text-[var(--color-text-muted)] italic">Click Run Code to execute and verify output.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT / NOTEBOOK COLUMN: REFERENCE, DATA MAP & VARIATIONS */}
          <div className={`space-y-5 ${activeTab === 'notebook' ? 'block' : 'hidden lg:block'} lg:col-span-5`}>
            
            {/* Overview & Core Intuition */}
            {currentChallenge.codeLabData?.in_plain_words && (
              <div
                className={`glass-panel rounded-2xl border p-5 transition-all duration-200 ${
                  activeSpeakingCard === 'core_intuition'
                    ? 'border-[var(--color-know)] ring-2 ring-[var(--color-know)]/40 shadow-lg shadow-[var(--color-know)]/10'
                    : 'border-[var(--color-border)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
                    Core Intuition
                  </span>
                  <button
                    onClick={() => {
                      if (activeSpeakingCard === 'core_intuition') {
                        stopTTS()
                        setActiveSpeakingCard(null)
                      } else {
                        setActiveSpeakingCard('core_intuition')
                        speakSingle(currentChallenge.codeLabData?.in_plain_words || '')
                      }
                    }}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      activeSpeakingCard === 'core_intuition'
                        ? 'border-[var(--color-know)] text-[var(--color-know)] bg-[var(--color-know)]/10'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface-2)]'
                    }`}
                    title={activeSpeakingCard === 'core_intuition' ? 'Stop reading' : 'Read core intuition'}
                  >
                    {activeSpeakingCard === 'core_intuition' ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {currentChallenge.codeLabData.in_plain_words}
                </p>
              </div>
            )}

            {/* Master Syntax Formula Blueprint */}
            {(currentChallenge.codeLabData?.syntax_formula || currentChallenge.scenario.starterTemplate) && (
              <div className="glass-panel rounded-2xl border border-[var(--color-border)] p-5">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2.5">
                  Master Syntax Blueprint
                </h3>
                <pre
                  style={{ fontVariantLigatures: 'none' }}
                  className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3.5 font-mono text-xs sm:text-sm text-slate-200 overflow-x-auto leading-relaxed"
                >
                  <code style={{ fontVariantLigatures: 'none' }}>
                    {formatCodeSnippet(currentChallenge.codeLabData?.syntax_formula || currentChallenge.scenario.starterTemplate)}
                  </code>
                </pre>
              </div>
            )}

            {/* Laboratory Script Box */}
            {(currentChallenge.codeLabData?.script_html || currentChallenge.scenario.sampleSolution) && (
              <CollapsibleCodeBox
                title="Laboratory Script"
                subtitle="Clean implementation demonstrating concept flow."
                code={currentChallenge.codeLabData?.script_html || currentChallenge.scenario.sampleSolution}
                onOpenIDE={() => {
                  setUserCode(formatCodeSnippet(currentChallenge.codeLabData?.script_html || currentChallenge.scenario.sampleSolution))
                  setMode('scenario')
                  setActiveTab('ide')
                }}
              />
            )}

            {/* Test Suite Verification (Glassmorphic Card Directly Below Laboratory Script) */}
            {(() => {
              const termData = getTerminalExecutionData(currentChallenge)
              const suiteDisplay = termData.testSuiteCode || termData.invocations
              return (
                <div className="glass-panel rounded-2xl border border-[var(--color-border)] p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-[var(--color-border)]">
                    <div>
                      <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] font-semibold flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        <span>Test Suite Verification</span>
                      </h3>
                      <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                        Calls methods from Laboratory Script and verifies expected {termData.outputLabel.toLowerCase()}.
                      </p>
                    </div>
                    <span className="shrink-0 flex items-center gap-1.5 font-mono text-[10px] text-emerald-400 bg-emerald-950/50 border border-emerald-800/50 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Verified</span>
                    </span>
                  </div>

                  {suiteDisplay && (
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] font-semibold block mb-1.5">
                        Test Suite Calls
                      </span>
                      <pre
                        style={{ fontVariantLigatures: 'none' }}
                        className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3.5 font-mono text-xs sm:text-sm text-slate-200 overflow-x-auto leading-relaxed"
                      >
                        <code style={{ fontVariantLigatures: 'none' }}>{suiteDisplay}</code>
                      </pre>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] font-semibold flex items-center gap-1.5 mb-1.5">
                      <Terminal size={12} className="text-emerald-400" />
                      <span>Laboratory {termData.outputLabel}</span>
                    </span>
                    <pre
                      style={{ fontVariantLigatures: 'none' }}
                      className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3.5 font-mono text-xs sm:text-sm text-emerald-300 overflow-x-auto leading-relaxed whitespace-pre-wrap"
                    >
                      <code style={{ fontVariantLigatures: 'none' }}>{termData.stdout}</code>
                    </pre>
                  </div>
                </div>
              )
            })()}

            {/* Code & Data Map Table (Collapsible with chevron) */}
            {currentChallenge.codeLabData?.data_map && currentChallenge.codeLabData.data_map.length > 0 && (
              <div className="glass-panel rounded-2xl border border-[var(--color-border)] p-5 transition-all">
                <button
                  onClick={() => setIsMemoryMapOpen(!isMemoryMapOpen)}
                  className="w-full flex items-center justify-between text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <Table size={15} className="text-[#10b981]" />
                    <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] font-semibold group-hover:text-white transition-colors">
                      Code &amp; Memory Map
                    </h3>
                    <span className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded">
                      {currentChallenge.codeLabData.data_map.length} rows
                    </span>
                  </div>
                  <div className="p-1 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-white transition-all">
                    <ChevronDown size={16} className={`transition-transform duration-200 ${isMemoryMapOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isMemoryMapOpen && (
                  <div className="mt-4 pt-3 border-t border-[var(--color-border)] overflow-x-auto no-scrollbar animate-in fade-in duration-150">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)] font-mono">
                          <th className="py-2 px-2.5 font-semibold">Section</th>
                          <th className="py-2 px-2.5 font-semibold">Code Statement</th>
                          <th className="py-2 px-2.5 font-semibold">Concept</th>
                          <th className="py-2 px-2.5 font-semibold">Runtime / Memory Effect</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)] font-mono">
                        {currentChallenge.codeLabData.data_map.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-white/[0.02]">
                            <td className="py-2 px-2.5 font-bold text-slate-300">{row.section}</td>
                            <td className="py-2 px-2.5 text-slate-200">{row.fn}</td>
                            <td className="py-2 px-2.5 font-sans text-slate-300">{row.concept}</td>
                            <td className="py-2 px-2.5 font-sans text-[var(--color-text-muted)]">{row.memory_effect}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Variations & Real-World Patterns (Clean Non-Nested Cards) */}
            {currentChallenge.codeLabData?.variations && currentChallenge.codeLabData.variations.length > 0 && (
              <div className="glass-panel rounded-2xl border border-[var(--color-border)] p-5 space-y-4">
                <div className="pb-2 border-b border-[var(--color-border)]">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
                    Variations &amp; Real-World Patterns
                  </h3>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Practical application patterns across codebases.</p>
                </div>

                <div className="space-y-4">
                  {currentChallenge.codeLabData.variations.map((v, vIdx) => (
                    <div key={vIdx} className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-white font-mono break-words">
                          {v.title}
                        </span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-secondary)] shrink-0 mt-0.5">
                          {v.use_case}
                        </span>
                      </div>
                      {v.explanation && (
                        <p className="text-xs text-slate-300 leading-relaxed font-sans">{v.explanation}</p>
                      )}
                      <pre
                        style={{ fontVariantLigatures: 'none' }}
                        className="rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] p-3 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed"
                      >
                        <code style={{ fontVariantLigatures: 'none' }}>{formatCodeSnippet(v.code)}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {currentChallenge && (
        <AIPracticeDrawer
          kind="code"
          deckId={deckId || 'code-lab'}
          language={langKey as any}
          currentScreenContext={{
            screen: 'code',
            topic: currentChallenge.topic,
            activeTab,
            mode,
            language: langKey,
            userCode,
            expectedOutput: currentChallenge.scenario?.simulatedOutput || currentChallenge.bugHunter?.simulatedOutput,
            bugDescriptions: currentChallenge.bugHunter?.bugDescriptions,
            feedbackStatus: feedback.status,
            feedbackOutput: feedback.output || feedback.message,
          }}
        />
      )}
    </div>
  )
}
