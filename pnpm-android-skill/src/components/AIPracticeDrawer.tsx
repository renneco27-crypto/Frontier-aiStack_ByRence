'use client'

/**
 * AIPracticeDrawer
 * ─────────────────────────────────────────────────────────
 * Collapsible side-drawer AI chat panel.
 * Mounts inside MathLabView.tsx and CodeLabView.tsx.
 *
 * Key Behaviors:
 *  - Strict Context & Memory Limit: Retains memory of ONLY the AI's last reply
 *    (max 350 chars) and the active topic (max 120 chars), preventing context
 *    and response length from snowballing over time.
 *  - Zero First-Load Token Waste: Does NOT auto-send requests when opened and
 *    never dumps full deck notes. Only when clicking action buttons or sending
 *    a message does it send the Topic Heading and Problem Breakdown.
 *  - Anti-Bleed Sanitization: Automatically strips any raw JSON/code bleeding
 *    ("problem": null, "evaluation": null, "suggestedActions": [...]) from
 *    stored and incoming messages.
 *  - Real TTS + Per-Block Sound Button: Auto-reads new assistant blocks when
 *    not muted, and provides a minimalist sound button on each block.
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react'
import {
  MessageSquare,
  X,
  Maximize2,
  Minimize2,
  Send,
  Volume2,
  VolumeX,
  Square,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Lightbulb,
  Compass,
  Code2,
  Terminal,
  RotateCcw,
  Sparkles,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react'
import KaTeXMath from './KaTeXMath'
import MathFormattedText from './MathFormattedText'
import { ttsService } from '@/lib/ttsService'
import { getAuthHeaders } from '@/lib/supabase'
import { apiUrl } from '@/lib/apiBase'

// ─── Strict Memory & Context Character Limits ─────────────
const MAX_TOPIC_CHARS = 120
const MAX_LAST_REPLY_CHARS = 350
const MAX_USER_PROMPT_CHARS = 350
const MAX_MEMORY_CONTEXT_CHARS = 500
const MAX_REPLY_DISPLAY_CHARS = 650

/**
 * Sanitizes assistant text so raw JSON keys ("problem": null, "evaluation": null,
 * "suggestedActions": [...], {"label": ..., "action": ...}) never bleed into the UI.
 */
function stripJsonBleed(input: string): string {
  if (!input) return ''
  let text = input.trim()

  // Strip markdown code fence wrappers if present
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  // Strip leading {"reply": "..." wrapper if present
  text = text.replace(/^\{\s*"reply"\s*:\s*"/i, '')

  // Cut off anything starting at leaked sibling JSON fields
  const bleedPatterns = [
    /"\s*,\s*"problem"\s*:/i,
    /\n\s*"problem"\s*:\s*(?:null|\{)/i,
    /\b"?problem"?\s*:\s*null\b/i,
    /"\s*,\s*"evaluation"\s*:/i,
    /\n\s*"evaluation"\s*:\s*(?:null|\{)/i,
    /\b"?evaluation"?\s*:\s*null\b/i,
    /"\s*,\s*"suggestedActions"\s*:/i,
    /\n\s*"suggestedActions"\s*:\s*\[/i,
    /\b"?suggestedActions"?\s*:\s*\[/i,
    /\[\s*\{\s*"label"\s*:/i,
  ]

  for (const pattern of bleedPatterns) {
    const match = text.search(pattern)
    if (match !== -1) {
      text = text.slice(0, match)
    }
  }

  text = text
    .replace(/",\s*$/, '')
    .replace(/"\s*\}\s*$/, '')
    .replace(/^\s*"/, '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim()

  if (text.length > MAX_REPLY_DISPLAY_CHARS) {
    const sliced = text.slice(0, MAX_REPLY_DISPLAY_CHARS)
    const lastBoundary = Math.max(
      sliced.lastIndexOf('. '),
      sliced.lastIndexOf('? '),
      sliced.lastIndexOf('.\n'),
      sliced.lastIndexOf('?\n')
    )
    text = (lastBoundary > 220 ? sliced.slice(0, lastBoundary + 1) : sliced).trim()
  }

  return text
}

// ─── Types ────────────────────────────────────────────────
export type DrawerKind = 'math' | 'code' | 'gallery'

export interface DrawerWikimediaImage {
  title: string
  imageUrl: string
  pageUrl: string
  caption?: string
}

interface ProblemStep {
  order: number
  latex?: string
  code?: string
  explanation: string
  operation?: string
}

interface Problem {
  id?: string
  noteId?: string
  noteFront?: string
  question: string
  latex?: string
  starter?: string
  language?: string
  difficulty?: string
  category?: string
  reference_answer?: string
  reference_steps?: ProblemStep[]
}

interface Evaluation {
  verdict: 'correct' | 'partial' | 'incorrect' | 'needs_clarification'
  feedback: string
  hint?: string
}

interface SuggestedAction {
  label: string
  action: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  problem?: Problem | null
  evaluation?: Evaluation | null
  suggestedActions?: SuggestedAction[]
  images?: DrawerWikimediaImage[]
}

export interface ProblemBreakdownContext {
  restate?: string
  given?: string[]
  formula_master?: string
  formula_working?: string
}

export interface ScreenContext {
  screen: 'math' | 'code' | 'gallery'
  topic: string
  activeTab?: string // 'solver' | 'notebook' | 'ide' | 'gallery'
  mode?: string // 'scenario' | 'bug_hunter' | 'practice'
  problem?: string
  problemBreakdown?: ProblemBreakdownContext
  answer?: string
  currentStep?: number
  totalSteps?: number
  activeStepLatex?: string
  activeStepExplanation?: string
  symbolTable?: Array<{ symbol: string; meaning: string; unit?: string }>
  solutionSteps?: string
  keyTakeaway?: string
  language?: string
  userCode?: string
  starterTemplate?: string
  expectedKeywords?: string[]
  expectedOutput?: string
  bugDescriptions?: string[]
  feedbackStatus?: string
  feedbackOutput?: string
}

export interface AIPracticeDrawerProps {
  kind: DrawerKind
  deckId: string
  notes?: Array<{ front: string; back?: string; subject?: string }>
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced'
  language?: 'java' | 'python' | 'sql' | 'javascript' | string
  currentScreenContext?: ScreenContext
  onRequestDeckImages?: (customQuery?: string) => Promise<DrawerWikimediaImage[]>
}

// ─── Persistent Memory Store (In-Memory + localStorage) ───
interface StoredSession {
  messages: ChatMessage[]
  thoughtSummary: string
  muted: boolean
}

const sessionMemoryMap = new Map<string, StoredSession>()

function getSessionKey(kind: DrawerKind, deckId: string): string {
  return `studyup_ai_drawer_v2_${kind}_${deckId || 'default'}`
}

function sanitizeStoredMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) =>
    m.role === 'assistant'
      ? { ...m, content: stripJsonBleed(m.content) }
      : m
  )
}

function loadSession(key: string): StoredSession {
  const mem = sessionMemoryMap.get(key)
  if (mem) return mem
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as StoredSession
        if (parsed && Array.isArray(parsed.messages)) {
          const sanitized: StoredSession = {
            messages: sanitizeStoredMessages(parsed.messages),
            thoughtSummary: (parsed.thoughtSummary || '').slice(0, MAX_MEMORY_CONTEXT_CHARS),
            muted: Boolean(parsed.muted),
          }
          sessionMemoryMap.set(key, sanitized)
          return sanitized
        }
      }
    } catch {
      // ignore storage errors
    }
  }
  return { messages: [], thoughtSummary: '', muted: false }
}

function saveSession(key: string, session: StoredSession) {
  sessionMemoryMap.set(key, session)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key, JSON.stringify(session))
    } catch {
      // ignore storage quota errors
    }
  }
}

/**
 * Builds strict, bounded memory of ONLY the active topic and the AI's last reply.
 * Does not accumulate multi-turn history so context and replies stay short.
 */
function buildLastReplyMemory(topic: string | undefined, messages: ChatMessage[]): string {
  const cleanTopic = (topic || 'General Topic').trim().slice(0, MAX_TOPIC_CHARS)
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && !m.content.startsWith('Error:'))
  if (!lastAssistant) {
    return `Topic: ${cleanTopic}`
  }
  const rawReply =
    stripJsonBleed(lastAssistant.content) ||
    lastAssistant.problem?.question?.trim() ||
    lastAssistant.evaluation?.feedback?.trim() ||
    ''
  const compactReply = rawReply.replace(/\s+/g, ' ').slice(0, MAX_LAST_REPLY_CHARS)
  return `Topic: ${cleanTopic} | Last Reply: ${compactReply}`.slice(0, MAX_MEMORY_CONTEXT_CHARS)
}

/**
 * Builds spoken plain-English text for a conversation block, converting
 * LaTeX notation into readable speech.
 */
function buildBlockSpeechText(msg: ChatMessage): string {
  const parts: string[] = []
  const cleanContent = stripJsonBleed(msg.content)
  const showText = !isRedundantText({ ...msg, content: cleanContent })
  if (showText && cleanContent) {
    parts.push(cleanContent)
  }
  if (msg.problem) {
    if (msg.problem.question) parts.push(msg.problem.question)
    if (msg.problem.latex) parts.push(latexToSpeech(msg.problem.latex))
    if (parts.length === 0 && msg.problem.reference_answer) {
      parts.push(latexToSpeech(msg.problem.reference_answer))
    }
  }
  if (msg.evaluation) {
    if (msg.evaluation.feedback) parts.push(msg.evaluation.feedback)
    if (msg.evaluation.hint) parts.push(`Hint: ${msg.evaluation.hint}`)
  }
  if (parts.length === 0 && cleanContent) {
    parts.push(cleanContent)
  }
  return parts.join('. ').replace(/\s+/g, ' ').trim()
}

function latexToSpeech(input: string): string {
  return input
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 over $2')
    .replace(/\\sqrt\{([^}]+)\}/g, 'square root of $1')
    .replace(/\\times/g, ' times ')
    .replace(/\\cdot/g, ' times ')
    .replace(/\\div/g, ' divided by ')
    .replace(/\\Delta/g, ' change in ')
    .replace(/\\pi/g, ' pi ')
    .replace(/\\theta/g, ' theta ')
    .replace(/\^2\b/g, ' squared')
    .replace(/\^3\b/g, ' cubed')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Determines whether the assistant's outer `msg.content` is redundant because
 * a structured `problem` or `evaluation` block already communicates the content.
 */
function isRedundantText(msg: ChatMessage): boolean {
  const text = (msg.content || '').trim()
  if (!text) return true
  const hasBlock = Boolean(msg.problem || msg.evaluation)
  if (!hasBlock) return false

  const normText = text.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!normText) return true

  if (msg.problem) {
    const qNorm = (msg.problem.question || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const lNorm = (msg.problem.latex || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const aNorm = (msg.problem.reference_answer || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    if (
      (qNorm && (normText.includes(qNorm.slice(0, 28)) || qNorm.includes(normText.slice(0, 28)))) ||
      (lNorm && normText.includes(lNorm.slice(0, 18))) ||
      (aNorm && aNorm.length > 20 && normText === aNorm)
    ) {
      // Only hide when the reply is essentially a copy of the block itself
      if (normText.length <= Math.max(qNorm.length, lNorm.length, aNorm.length) + 10) return true
    }
  }

  if (msg.evaluation) {
    const fNorm = (msg.evaluation.feedback || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    if (fNorm && normText === fNorm) {
      return true
    }
  }

  return false
}

// ─── Verdict badge ────────────────────────────────────────
function VerdictBadge({ verdict }: { verdict: Evaluation['verdict'] }) {
  const map = {
    correct: {
      icon: <CheckCircle2 size={13} />,
      label: 'Correct',
      cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    partial: {
      icon: <MinusCircle size={13} />,
      label: 'Partial',
      cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    incorrect: {
      icon: <XCircle size={13} />,
      label: 'Incorrect',
      cls: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    },
    needs_clarification: {
      icon: <HelpCircle size={13} />,
      label: 'Clarify',
      cls: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    },
  }
  const v = map[verdict] ?? map.needs_clarification
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-mono font-medium ${v.cls}`}
    >
      {v.icon}
      {v.label}
    </span>
  )
}

// ─── Problem card ─────────────────────────────────────────
function ProblemCard({
  problem,
  kind,
}: {
  problem: Problem
  kind: DrawerKind
}) {
  const [showRef, setShowRef] = useState(false)
  const steps = Array.isArray(problem.reference_steps) ? problem.reference_steps : []

  return (
    <div className="mt-1 rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-accent,#ff2d85)]">
          {problem.difficulty || 'Intermediate'} · {problem.category || (kind === 'math' ? 'Math' : 'Code')}
        </span>
      </div>

      {/* Question */}
      <div className="px-3 py-2.5">
        {problem.question && (
          <div className="text-xs text-slate-200 leading-relaxed">
            <MathFormattedText text={problem.question} />
          </div>
        )}

        {/* Math: KaTeX */}
        {kind === 'math' && problem.latex && (
          <div className="mt-2 text-center text-sm text-white overflow-x-auto py-1">
            <KaTeXMath math={problem.latex} displayMode={true} />
          </div>
        )}

        {/* Code: starter block */}
        {kind === 'code' && problem.starter && (
          <pre className="mt-2 p-2.5 rounded-xl bg-black/40 border border-white/8 text-[11px] font-mono text-emerald-300 leading-5 overflow-x-auto whitespace-pre-wrap">
            <code>{problem.starter}</code>
          </pre>
        )}
      </div>

      {/* Reference toggle */}
      {(problem.reference_answer || steps.length > 0) && (
        <>
          <button
            onClick={() => setShowRef((p) => !p)}
            className="w-full px-3 py-1.5 border-t border-white/8 text-[10px] font-mono text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-1 transition-colors cursor-pointer"
          >
            {showRef ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {showRef ? 'Hide reference' : 'Show reference answer'}
          </button>

          {showRef && (
            <div className="px-3 pb-3 pt-1 space-y-2">
              {problem.reference_answer && (
                <div className="text-[11px] text-emerald-300 font-mono">
                  <MathFormattedText text={problem.reference_answer} />
                </div>
              )}
              {steps.length > 0 && (
                <ol className="space-y-1.5">
                  {steps.map((s) => (
                    <li key={s.order} className="text-[11px] text-slate-300 leading-relaxed">
                      <span className="text-[var(--color-accent,#ff2d85)] font-mono mr-1">
                        {s.order}.
                      </span>
                      <MathFormattedText text={s.explanation} />
                      {s.latex ? (
                        <div className="mt-1 ml-3 text-emerald-300 overflow-x-auto">
                          <KaTeXMath math={s.latex} displayMode={false} />
                        </div>
                      ) : s.code ? (
                        <pre className="mt-0.5 ml-3 font-mono text-[10px] text-emerald-300 bg-black/30 rounded px-2 py-1 overflow-x-auto">
                          <code>{s.code}</code>
                        </pre>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Single chat bubble ───────────────────────────────────
function ChatBubble({
  msg,
  kind,
  muted,
  isSpeaking,
  onToggleSpeak,
  onAction,
}: {
  msg: ChatMessage
  kind: DrawerKind
  muted: boolean
  isSpeaking: boolean
  onToggleSpeak: () => void
  onAction: (actionPrompt: string, label: string) => void
}) {
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm bg-[var(--color-accent,#ff2d85)]/15 border border-[var(--color-accent,#ff2d85)]/25 text-xs text-white leading-relaxed whitespace-pre-wrap">
          <MathFormattedText text={msg.content} />
        </div>
      </div>
    )
  }

  const sanitizedContent = stripJsonBleed(msg.content)
  const showOuterBubble = Boolean(sanitizedContent) && !isRedundantText({ ...msg, content: sanitizedContent })
  const hasSpokenContent = Boolean(
    showOuterBubble || msg.problem || msg.evaluation
  )

  return (
    <div className="flex flex-col gap-2">
      {/* AI reply text (hidden when redundant with problem/evaluation block) */}
      {showOuterBubble && (
        <div className="max-w-[92%] px-3 py-2 rounded-2xl rounded-tl-sm bg-white/[0.05] border border-white/10 text-xs text-slate-200 leading-relaxed flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 whitespace-pre-wrap space-y-1">
            <MathFormattedText text={sanitizedContent} />
          </div>
          {hasSpokenContent && !msg.problem && !msg.evaluation && (
            <button
              type="button"
              onClick={onToggleSpeak}
              title={isSpeaking ? 'Stop reading' : 'Read block aloud'}
              className={`p-1 rounded-md border transition-colors shrink-0 ${
                isSpeaking
                  ? 'border-[var(--color-accent,#ff2d85)]/40 bg-[var(--color-accent,#ff2d85)]/15 text-white cursor-pointer'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer'
              }`}
            >
              {isSpeaking ? <Square size={10} /> : <Volume2 size={11} />}
            </button>
          )}
        </div>
      )}

      {/* Problem card */}
      {msg.problem && (
        <div className="max-w-[95%]">
          <div className="flex items-center justify-end mb-1">
            <button
              type="button"
              onClick={onToggleSpeak}
              title={isSpeaking ? 'Stop reading' : 'Read block aloud'}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono transition-colors ${
                isSpeaking
                  ? 'border-[var(--color-accent,#ff2d85)]/40 bg-[var(--color-accent,#ff2d85)]/15 text-white cursor-pointer'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer'
              }`}
            >
              {isSpeaking ? <Square size={9} /> : <Volume2 size={10} />}
              <span>{isSpeaking ? 'Stop' : 'Read'}</span>
            </button>
          </div>
          <ProblemCard problem={msg.problem} kind={kind} />
        </div>
      )}

      {/* Evaluation */}
      {msg.evaluation && (
        <div className="max-w-[92%] px-3 py-2 rounded-2xl bg-white/[0.03] border border-white/8 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <VerdictBadge verdict={msg.evaluation.verdict} />
            <button
              type="button"
              onClick={onToggleSpeak}
              title={isSpeaking ? 'Stop reading' : 'Read block aloud'}
              className={`p-1 rounded-md border transition-colors ${
                isSpeaking
                  ? 'border-[var(--color-accent,#ff2d85)]/40 bg-[var(--color-accent,#ff2d85)]/15 text-white cursor-pointer'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer'
              }`}
            >
              {isSpeaking ? <Square size={10} /> : <Volume2 size={11} />}
            </button>
          </div>
          <div className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">
            <MathFormattedText text={msg.evaluation.feedback} />
          </div>
          {msg.evaluation.hint && (
            <div className="text-[11px] text-slate-400 italic border-l-2 border-[var(--color-accent,#ff2d85)]/40 pl-2">
              Hint: <MathFormattedText text={msg.evaluation.hint} />
            </div>
          )}
        </div>
      )}

      {/* Wikimedia Images synced to Gallery */}
      {msg.images && msg.images.length > 0 && (
        <div className="max-w-[95%] space-y-2">
          {msg.images.map((img, idx) => (
            <div
              key={`${img.imageUrl}-${idx}`}
              className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden shadow-md"
            >
              <div className="relative aspect-[16/10] bg-black/40 overflow-hidden">
                <img
                  src={img.imageUrl}
                  alt={img.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500/90 text-slate-950 text-[10px] font-bold shadow">
                  Added to Gallery Grid ✓
                </span>
              </div>
              <div className="p-2.5 space-y-1">
                <div className="text-xs font-semibold text-white line-clamp-1">
                  {img.title}
                </div>
                <a
                  href={img.pageUrl || img.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 underline break-all"
                >
                  <ExternalLink size={10} className="shrink-0" />
                  <span className="line-clamp-1">{img.imageUrl}</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suggested actions */}
      {msg.suggestedActions && msg.suggestedActions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-w-[92%]">
          {msg.suggestedActions.map((a, idx) => (
            <button
              key={`${a.action}-${idx}`}
              onClick={() => onAction(a.action || a.label, a.label)}
              className="px-2.5 py-1 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main drawer ──────────────────────────────────────────
export default function AIPracticeDrawer({
  kind,
  deckId,
  difficulty = 'Intermediate',
  language,
  currentScreenContext,
  onRequestDeckImages,
}: AIPracticeDrawerProps) {
  const sessionKey = getSessionKey(kind, deckId)

  type DrawerState = 'collapsed' | 'open' | 'expanded'
  const [drawerState, setDrawerState] = useState<DrawerState>('collapsed')
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadSession(sessionKey).messages)
  const [thoughtSummary, setThoughtSummary] = useState<string>(() => loadSession(sessionKey).thoughtSummary)
  const [muted, setMuted] = useState<boolean>(() => loadSession(sessionKey).muted)
  const mutedRef = useRef<boolean>(muted)
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [quota, setQuota] = useState<{ remainingChars: number; usedChars: number; maxChars: number; resetAt: number } | null>(null)
  const [, setModelInfo] = useState<{ provider?: string; model?: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  // Sync session when deckId or kind changes
  useEffect(() => {
    const loaded = loadSession(sessionKey)
    setMessages(loaded.messages)
    setThoughtSummary(loaded.thoughtSummary)
    setMuted(loaded.muted)
    mutedRef.current = loaded.muted
  }, [sessionKey])

  // Persist session in memory + localStorage so exiting never resets conversation
  useEffect(() => {
    saveSession(sessionKey, { messages, thoughtSummary, muted })
  }, [sessionKey, messages, thoughtSummary, muted])

  // ── Draggable vertical position (pill only) ──────────────
  const [pillTop, setPillTop] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startY: number; startTop: number } | null>(null)
  const pillRef = useRef<HTMLButtonElement>(null)

  const handleDragStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    const el = pillRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragRef.current = { startY: e.clientY, startTop: rect.top }
    el.setPointerCapture(e.pointerId)
    setIsDragging(true)

    // Bind move/up to document so drag continues outside the button bounds
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return
      const delta = ev.clientY - dragRef.current.startY
      const next = dragRef.current.startTop + delta
      const min = 8
      const max = window.innerHeight - 72
      setPillTop(Math.max(min, Math.min(max, next)))
    }
    const onUp = () => {
      dragRef.current = null
      setIsDragging(false)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      try { el.releasePointerCapture(e.pointerId) } catch {}
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
  }

  // Auto-scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Stop TTS when drawer collapses
  useEffect(() => {
    if (drawerState === 'collapsed') {
      ttsService.stop()
      setSpeakingIdx(null)
    }
  }, [drawerState])

  // ── Speak a specific conversation block ──────────────────
  const speakBlock = useCallback(
    (msg: ChatMessage, index: number, forceSpeak = false) => {
      if (muted && !forceSpeak) return
      if (speakingIdx === index && ttsService.isSpeaking()) {
        ttsService.stop()
        setSpeakingIdx(null)
        return
      }
      const textToRead = buildBlockSpeechText(msg)
      if (!textToRead) return
      setSpeakingIdx(index)
      ttsService.speak(textToRead, {
        rate: 1.0,
        onEnd: () => setSpeakingIdx((curr) => (curr === index ? null : curr)),
        onStop: () => setSpeakingIdx((curr) => (curr === index ? null : curr)),
      })
    },
    [muted, speakingIdx]
  )

  // ── API call (sends ONLY Topic + AI's Last Reply + Current User Prompt) ──
  const postChat = useCallback(
    async (
      priorMessages: ChatMessage[],
      currentUserPrompt: string,
      includeStepDetail = false
    ) => {
      setLoading(true)
      try {
        const safeTopic = (currentScreenContext?.topic || 'General Topic').slice(0, MAX_TOPIC_CHARS)
        const lastAssistant = [...priorMessages]
          .reverse()
          .find((m) => m.role === 'assistant' && !m.content.startsWith('Error:'))

        const lastReplyText = lastAssistant
          ? (
              stripJsonBleed(lastAssistant.content) ||
              lastAssistant.problem?.question?.trim() ||
              lastAssistant.evaluation?.feedback?.trim() ||
              ''
            ).slice(0, MAX_LAST_REPLY_CHARS)
          : ''

        // Build strictly bounded messages array: at most [lastAssistantReply, currentUserPrompt]
        const boundedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []
        if (lastReplyText) {
          boundedMessages.push({
            role: 'assistant',
            content: lastReplyText,
          })
        }
        boundedMessages.push({
          role: 'user',
          content: currentUserPrompt.trim().slice(0, MAX_USER_PROMPT_CHARS),
        })

        const leanScreenContext: ScreenContext | undefined = currentScreenContext
          ? {
              screen: currentScreenContext.screen,
              topic: safeTopic,
              activeTab: currentScreenContext.activeTab,
              mode: currentScreenContext.mode,
              problem: currentScreenContext.problem?.slice(0, 260),
              problemBreakdown: currentScreenContext.problemBreakdown,
              ...(includeStepDetail
                ? {
                    currentStep: currentScreenContext.currentStep,
                    totalSteps: currentScreenContext.totalSteps,
                    activeStepLatex: currentScreenContext.activeStepLatex?.slice(0, 140),
                    activeStepExplanation: currentScreenContext.activeStepExplanation?.slice(0, 140),
                  }
                : {}),
              ...(kind === 'code'
                ? {
                    language: currentScreenContext.language,
                    userCode: currentScreenContext.userCode?.slice(0, 600),
                    expectedOutput: currentScreenContext.expectedOutput?.slice(0, 160),
                    feedbackStatus: currentScreenContext.feedbackStatus,
                    feedbackOutput: currentScreenContext.feedbackOutput?.slice(0, 160),
                  }
                : {}),
            }
          : undefined

        const res = await fetch(apiUrl('/api/lab/chat'), {
          method: 'POST',
          headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            kind,
            deckId,
            messages: boundedMessages,
            thoughtSummary: lastReplyText || undefined,
            difficulty,
            language,
            action: 'reply',
            screenContext: leanScreenContext,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error ?? `HTTP ${res.status}`)
        }

        const data = await res.json()
        if (data.quota) setQuota(data.quota)
        if (data.provider || data.model) setModelInfo({ provider: data.provider, model: data.model })

        const cleanReply = stripJsonBleed(data.reply ?? '')
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: cleanReply,
          problem: data.problem ?? null,
          evaluation: data.evaluation ?? null,
          suggestedActions: data.suggestedActions ?? [],
        }

        const newIdx = priorMessages.length + 1
        setMessages((prev) => {
          const updated = [...prev, assistantMsg]
          setThoughtSummary(buildLastReplyMemory(safeTopic, updated))
          return updated
        })

        if (!mutedRef.current) {
          const speech = buildBlockSpeechText(assistantMsg)
          if (speech) {
            setSpeakingIdx(newIdx)
            ttsService.speak(speech, {
              rate: 1.0,
              onEnd: () => setSpeakingIdx((c) => (c === newIdx ? null : c)),
              onStop: () => setSpeakingIdx((c) => (c === newIdx ? null : c)),
            })
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong.'
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${msg}`,
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [kind, deckId, difficulty, language, currentScreenContext]
  )

  // ── Open drawer (does NOT auto-send request on first load) ──
  const handleOpen = useCallback(() => {
    setDrawerState('open')
  }, [])

  // ── Handle "Give me images" Wikimedia fetch & Gallery sync ──
  const handleFetchWikimediaImages = useCallback(
    async (customTopic?: string, userLabel = 'Give me images from notes') => {
      if (!onRequestDeckImages || loading) return
      const userMsg: ChatMessage = {
        role: 'user',
        content: userLabel,
      }
      setMessages((prev) => [...prev, userMsg])
      setLoading(true)
      try {
        const fetched = await onRequestDeckImages(customTopic)
        if (fetched.length > 0) {
          const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: `Found ${fetched.length} educational diagram${fetched.length === 1 ? '' : 's'} from your notes and added ${fetched.length === 1 ? 'it' : 'them'} directly to your Gallery grid:`,
            images: fetched,
            suggestedActions: [
              { label: 'Give me more images', action: 'Give me images from notes' },
              { label: 'Explain these diagrams', action: `Explain the visual concepts behind ${fetched.map((f) => f.title).slice(0, 3).join(', ')}` },
            ],
          }
          setMessages((prev) => [...prev, assistantMsg])
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                'No new images matched those note topics (or all matching images are already in your Gallery). Try typing "Give me images for <topic>" with a specific concept.',
            },
          ])
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Could not retrieve images: ${err instanceof Error ? err.message : 'Network error'}`,
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [onRequestDeckImages, loading]
  )

  // ── Send user message or quick action ─────────────────────
  const handleSend = useCallback(
    (actionPrompt?: string, displayLabel?: string, includeStepDetail = false) => {
      const promptText = (actionPrompt ?? input).trim()
      if (!promptText || loading) return
      if (!actionPrompt) setInput('')

      // Intercept "Give me images" requests in Gallery mode so they fetch from Wikimedia & sync to Gallery
      if (kind === 'gallery' && onRequestDeckImages) {
        if (
          promptText === '__GIVE_ME_IMAGES__' ||
          /^give me (more )?images(\s+from\s+notes)?$/i.test(promptText)
        ) {
          handleFetchWikimediaImages(undefined, displayLabel || 'Give me images')
          return
        }
        const customMatch = promptText.match(
          /(?:give me images|find images|get images|show images|images|diagram|photo)\s+(?:for|of|about|on)\s+(.+)/i
        )
        if (customMatch && customMatch[1]) {
          handleFetchWikimediaImages(customMatch[1].trim(), displayLabel || promptText)
          return
        }
      }

      const userMsg: ChatMessage = {
        role: 'user',
        content: (displayLabel || promptText).slice(0, MAX_USER_PROMPT_CHARS),
      }
      const nextUiMessages = [...messages, userMsg]
      const nextSummary = buildLastReplyMemory(currentScreenContext?.topic, messages)

      setMessages(nextUiMessages)
      setThoughtSummary(nextSummary)
      postChat(messages, promptText, includeStepDetail)
    },
    [input, loading, kind, onRequestDeckImages, handleFetchWikimediaImages, messages, currentScreenContext?.topic, postChat]
  )

  // ── Reset session memory explicitly if user requests ──────
  const handleClearMemory = useCallback(() => {
    ttsService.stop()
    setSpeakingIdx(null)
    setMessages([])
    setThoughtSummary('')
    saveSession(sessionKey, { messages: [], thoughtSummary: '', muted })
  }, [sessionKey, muted])

  // ── Keyboard: Enter to send (Shift+Enter = newline) ───────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Drawer width ──────────────────────────────────────────
  const drawerWidth =
    drawerState === 'expanded' ? 600 : drawerState === 'open' ? 380 : 44

  // ─── Collapsed pill ──────────────────────────────────────
  if (drawerState === 'collapsed') {
    const pillStyle: React.CSSProperties = pillTop !== null
      ? { top: pillTop }
      : { top: '50%', transform: 'translateY(-50%)' }

    return (
      <button
        ref={pillRef}
        onClick={() => { if (!isDragging) handleOpen() }}
        onPointerDown={handleDragStart}
        aria-label="Open AI Practice"
        style={pillStyle}
        className={`
          fixed right-0 z-50
          w-8 h-16 rounded-l-xl
          bg-[var(--color-surface-1,#0f172a)]/95 backdrop-blur-xl
          border border-r-0 border-[var(--color-border,rgba(255,255,255,0.1))]
          flex flex-col items-center justify-center gap-1
          text-[var(--color-accent,#ff2d85)] hover:text-white
          hover:bg-[var(--color-accent,#ff2d85)]/10
          transition-colors duration-150 shadow-xl ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
          select-none group touch-none
        `}
      >
        <div className="flex flex-col gap-[3px] opacity-40 group-hover:opacity-70 transition-opacity">
          <div className="w-[3px] h-[3px] rounded-full bg-current" />
          <div className="w-[3px] h-[3px] rounded-full bg-current" />
          <div className="w-[3px] h-[3px] rounded-full bg-current" />
        </div>
        <MessageSquare size={13} className="group-hover:scale-110 transition-transform" />
        <span className="text-[8px] font-bold tracking-widest">AI</span>
      </button>
    )
  }

  // ─── Open / Expanded drawer ───────────────────────────────
  return (
    <div
      style={{ width: drawerWidth }}
      className={`
        fixed right-0 top-0 bottom-0 z-50
        flex flex-col
        bg-[var(--color-surface-1,#0f172a)]/98 backdrop-blur-2xl
        border-l border-[var(--color-border,rgba(255,255,255,0.1))]
        shadow-[-24px_0_64px_rgba(0,0,0,0.5)]
        transition-all duration-200 ease-out
      `}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-white/8 shrink-0 gap-2">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <MessageSquare size={14} className="text-[var(--color-accent,#ff2d85)] shrink-0" />
            <span className="text-xs font-bold text-white tracking-wide">
              {kind === 'math'
                ? 'MathLab AI Tutor'
                : kind === 'code'
                  ? 'CodeLab AI Tutor'
                  : 'Gallery Visual AI'}
            </span>
            {currentScreenContext?.activeTab && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 uppercase tracking-wider">
                {currentScreenContext.activeTab}
              </span>
            )}
          </div>
          {currentScreenContext?.topic && (
            <span
              className="text-[11px] text-[var(--color-text-muted,#94a3b8)] font-sans truncate mt-0.5"
              title={currentScreenContext.topic}
            >
              {currentScreenContext.topic}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {quota && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              title={`AI Output: ${quota.remainingChars.toLocaleString()} / ${quota.maxChars.toLocaleString()} characters remaining in 5h window`}
            >
              <Sparkles size={10} />
              {(quota.remainingChars / 1000).toFixed(1)}k
            </span>
          )}

          {/* Mute toggle */}
          <button
            onClick={() => {
              const nextMuted = !muted
              if (nextMuted) {
                ttsService.stop()
                setSpeakingIdx(null)
              }
              setMuted(nextMuted)
            }}
            className="p-1.5 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={muted ? 'Unmute auto-reader' : 'Mute auto-reader'}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          {/* Clear memory button (only shown when messages exist) */}
          {messages.length > 0 && (
            <button
              onClick={handleClearMemory}
              className="p-1.5 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Reset conversation memory"
            >
              <RotateCcw size={13} />
            </button>
          )}

          {/* Expand / shrink */}
          <button
            onClick={() =>
              setDrawerState((s) => (s === 'expanded' ? 'open' : 'expanded'))
            }
            className="p-1.5 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={drawerState === 'expanded' ? 'Shrink' : 'Expand'}
          >
            {drawerState === 'expanded' ? (
              <Minimize2 size={14} />
            ) : (
              <Maximize2 size={14} />
            )}
          </button>

          {/* Close */}
          <button
            onClick={() => {
              ttsService.stop()
              setSpeakingIdx(null)
              setDrawerState('collapsed')
            }}
            className="p-1.5 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Message list ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 scroll-smooth">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-6 px-2">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent,#ff2d85)]/10 border border-[var(--color-accent,#ff2d85)]/20 flex items-center justify-center shadow-lg">
              <MessageSquare size={22} className="text-[var(--color-accent,#ff2d85)]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white px-2">
                {currentScreenContext?.topic || 'Interactive AI Tutor'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[240px] leading-relaxed mx-auto">
                {kind === 'gallery'
                  ? 'Find educational diagrams from your notes and add them directly to your Gallery grid:'
                  : `Connected directly to your active ${kind === 'math' ? 'problem' : 'code'} on screen. Pick a quick action to begin:`}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 justify-center mt-2 max-w-[280px]">
              {kind === 'gallery' ? (
                <>
                  <button
                    onClick={() => handleSend('__GIVE_ME_IMAGES__', 'Give me images')}
                    className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-[var(--color-accent,#ff2d85)]/20 hover:bg-[var(--color-accent,#ff2d85)]/30 text-white border border-[var(--color-accent,#ff2d85)]/40 font-semibold transition-colors cursor-pointer active:scale-95"
                  >
                    <ImageIcon size={12} />
                    <span>Give me images</span>
                  </button>
                  <button
                    onClick={() =>
                      handleSend(
                        'Explain the main visual concepts and diagrams I should know for these notes.',
                        'Explain Visual Concepts',
                        false
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer active:scale-95"
                  >
                    <BookOpen size={11} />
                    <span>Explain Visual Concepts</span>
                  </button>
                  <button
                    onClick={() =>
                      handleSend(
                        'Quiz me on the key anatomical, physical, or structural diagrams in this deck.',
                        'Visual Quiz',
                        false
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer active:scale-95"
                  >
                    <Lightbulb size={11} />
                    <span>Visual Quiz</span>
                  </button>
                </>
              ) : kind === 'math' ? (
                <>
                  <button
                    onClick={() =>
                      handleSend(
                        'Review the working formula and problem breakdown for this topic.',
                        'Review Formula',
                        false
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer active:scale-95"
                  >
                    <BookOpen size={11} />
                    <span>Review Formula</span>
                  </button>
                  <button
                    onClick={() =>
                      handleSend(
                        'Can you explain what happens in this step?',
                        'Explain Step',
                        true
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer active:scale-95"
                  >
                    <Lightbulb size={11} />
                    <span>Explain Step</span>
                  </button>
                  <button
                    onClick={() =>
                      handleSend(
                        'Give me a hint for solving this problem based on the problem breakdown.',
                        'Give Me A Hint',
                        false
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer active:scale-95"
                  >
                    <Compass size={11} />
                    <span>Give Me A Hint</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() =>
                      handleSend(
                        'Can you review my code and point out any issues?',
                        'Review My Code',
                        false
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer active:scale-95"
                  >
                    <Code2 size={11} />
                    <span>Review My Code</span>
                  </button>
                  <button
                    onClick={() =>
                      handleSend(
                        'What should I write next to meet the requirements?',
                        'Next Line Hint',
                        false
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer active:scale-95"
                  >
                    <Lightbulb size={11} />
                    <span>Next Line Hint</span>
                  </button>
                  <button
                    onClick={() =>
                      handleSend(
                        'Explain the expected output and edge cases.',
                        'Expected Output',
                        false
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer active:scale-95"
                  >
                    <Terminal size={11} />
                    <span>Expected Output</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble
            key={i}
            msg={msg}
            kind={kind}
            muted={muted}
            isSpeaking={speakingIdx === i}
            onToggleSpeak={() => speakBlock(msg, i, true)}
            onAction={(actionPrompt, label) => handleSend(actionPrompt, label, false)}
          />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 size={14} className="animate-spin text-[var(--color-accent,#ff2d85)]" />
            <span className="text-xs">Thinking…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input footer ────────────────────────────────────── */}
      <div className="px-3 pb-4 pt-2 border-t border-white/8 shrink-0">
        {kind === 'gallery' && onRequestDeckImages && (
          <div className="flex items-center gap-1.5 mb-2">
            <button
              type="button"
              onClick={() => handleSend('__GIVE_ME_IMAGES__', 'Give me images')}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full bg-[var(--color-accent,#ff2d85)]/15 hover:bg-[var(--color-accent,#ff2d85)]/25 text-white border border-[var(--color-accent,#ff2d85)]/35 font-medium transition-colors cursor-pointer disabled:opacity-40"
            >
              <ImageIcon size={11} />
              <span>Give me images</span>
            </button>
            <span className="text-[10px] text-slate-500 truncate">
              Syncs educational photos & diagrams to Gallery
            </span>
          </div>
        )}
        <div className="flex items-end gap-2 bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={MAX_USER_PROMPT_CHARS}
            placeholder={
              kind === 'gallery'
                ? 'Ask or type "Give me images for <topic>"…'
                : 'Type your answer…'
            }
            className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 outline-none resize-none leading-5 max-h-28 overflow-y-auto"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-1.5 rounded-xl bg-[var(--color-accent,#ff2d85)] text-white hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0 cursor-pointer"
            title="Send"
          >
            <Send size={13} />
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-1.5 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
