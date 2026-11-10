'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Eye, EyeOff, Search, ChevronDown, Tag, Volume2, VolumeX, X } from 'lucide-react'
import { getCardsByDeck, bulkDeleteCards } from '@/db/cardRepository'
import { getDeck } from '@/db/deckRepository'
import { normalizeTextForDedup } from '@/lib/deckDeduplicator'
import { getAuthHeaders } from '@/lib/supabase'
import StudyHeader, { HeaderIconButton } from '@/components/StudyHeader'
import ExportButton from '@/features/export/ExportButton'
import MathFormattedText from '@/components/MathFormattedText'
import StructuredBlockRenderer from '@/components/StructuredBlockRenderer'
import { useTTS } from '@/hooks/useTTS'
import { tableToSpeech } from '@/lib/ttsService'
import type { Card, Deck } from '@/lib/zodSchemas'
import type { BackBlock } from '@/lib/relay/relayTypes'

function parseRawNoteToBlocks(rawText: string, cardTitle?: string): BackBlock[] {
  if (!rawText) return []
  const blocks: BackBlock[] = []

  // 1. Check for table directives &[TABLE: ...]
  const tableRegex = /&\[TABLE:\s*([\s\S]*?)\]/gi
  const cleanedText = rawText.replace(tableRegex, (_, content) => {
    if (content.includes('||') || content.includes('¦')) {
      const rawRows = content.split('||').map((r: string) => r.trim()).filter(Boolean)
      if (rawRows.length > 0) {
        const columns = rawRows[0].split('¦').map((c: string) => c.trim()).filter(Boolean)
        const rows = rawRows.slice(1).map((row: string) => row.split('¦').map((c: string) => c.trim()))
        blocks.push({ kind: 'table', label: 'Data Table', columns, rows })
      }
    } else {
      const lines = content.split('|').map((s: string) => s.trim()).filter(Boolean)
      if (lines.length > 0) {
        const columns = lines[0].split(',').map((c: string) => c.trim())
        const rows = lines.slice(1).map((r: string) => r.split(',').map((c: string) => c.trim()))
        blocks.push({ kind: 'table', label: 'Data Table', columns, rows })
      }
    }
    return ''
  })

  // 2. Process remaining lines/bullets
  const lines = cleanedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const stepItems: string[] = []
  let activeStepLabel = 'Key Steps'

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const cleanLine = line.replace(/^[•\-\*]\s*/, '').trim()
    if (!cleanLine) continue

    // Numbered step (e.g. "1. Step description" or "Step 1:")
    const stepMatch = cleanLine.match(/^(?:(?:Step\s+)?(\d+)[:.)]\s*)(.*)/i)
    if (stepMatch) {
      stepItems.push(stepMatch[2] || cleanLine)
      continue
    }

    // Sub-header label like "UCD Process :" or "Key Principles:"
    if (/^[A-Za-z0-9\s()&/,'.-]{1,40}\s*:$/i.test(cleanLine)) {
      if (stepItems.length > 0) {
        blocks.push({ kind: 'steps', label: activeStepLabel, items: [...stepItems] })
        stepItems.length = 0
      }
      activeStepLabel = cleanLine.replace(/:$/, '').trim()
      continue
    }

    // If we have accumulated numbered steps, flush them before processing a non-step
    if (stepItems.length > 0) {
      blocks.push({ kind: 'steps', label: activeStepLabel, items: [...stepItems] })
      stepItems.length = 0
      activeStepLabel = 'Key Steps'
    }

    // Example style
    if (/^example[:–-]/i.test(cleanLine)) {
      blocks.push({
        kind: 'example',
        label: 'Example',
        text: cleanLine.replace(/^example[:–-]\s*/i, ''),
      })
      continue
    }

    // Formula style
    if (/^formula[:–-]/i.test(cleanLine) || cleanLine.includes('$$')) {
      blocks.push({
        kind: 'formula',
        label: 'Formula',
        text: cleanLine.replace(/^formula[:–-]\s*/i, ''),
      })
      continue
    }

    // Definition style: "Term — Definition", "Term – Definition", "Term: Definition", "**Term** — Definition"
    const defMatch = cleanLine.match(/^(?:(?:\d+[:.)]\s*)?(\*\*[^*]+\*\*|[A-Za-z0-9][A-Za-z0-9\s()&/,'.-]{1,50}?))\s*(?:—|–|:|-)\s+(.+)/)
    if (defMatch) {
      let term = defMatch[1].replace(/\*\*/g, '').trim()
      term = term.replace(/^\d+[\.\)]\s*/, '').trim()
      blocks.push({
        kind: 'definition',
        term,
        text: defMatch[2].trim(),
      })
      continue
    }

    // If multiple short standalone lines follow each other, treat as list items
    if (cleanLine.length < 50 && !cleanLine.endsWith('.')) {
      stepItems.push(cleanLine)
      continue
    }

    // Default note block
    blocks.push({
      kind: 'note',
      text: cleanLine,
    })
  }

  if (stepItems.length > 0) {
    blocks.push({ kind: 'steps', label: activeStepLabel, items: stepItems })
  }

  return blocks
}

function FormattedNoteText({ text, hideBold = false }: { text: string; hideBold?: boolean }) {
  // If the text is or contains a Table Directive or Markdown Table, render it directly via MathFormattedText
  if (/&\[\s*table/i.test(text) || (text.includes('|') && text.includes('\n') && /\|.*\|/.test(text))) {
    return (
      <div className="text-[15px] text-[#cbd5e1] leading-relaxed">
        <MathFormattedText text={text} hideBold={hideBold} />
      </div>
    )
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  // Split multiple lines or bullet points
  const items: string[] = []
  for (const line of lines) {
    if (line.includes('•') && !/&\[/i.test(line)) {
      const parts = line.split('•').map(p => p.trim()).filter(Boolean)
      items.push(...parts)
    } else {
      items.push(line)
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-[15px] text-[#cbd5e1] leading-relaxed">
        <MathFormattedText text={text} hideBold={hideBold} />
      </div>
    )
  }

  return (
    <div className="space-y-2 pt-1">
      {items.map((item, idx) => {
        // If this item contains a Table or Code directive, render it directly without splitting on '|'
        if (/&\[/i.test(item)) {
          return (
            <div key={idx} className="my-1.5">
              <MathFormattedText text={item} hideBold={hideBold} />
            </div>
          )
        }

        // Check for key-value pair like "Born: Feb 8, 1890 | Died: Oct 2, 1960"
        const segments = item.split('|').map(s => s.trim()).filter(Boolean)

        return (
          <div key={idx} className="flex items-start gap-2.5 text-[14px] sm:text-[15px] text-[#cbd5e1] leading-relaxed min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7e57ff] mt-2 shrink-0 select-none inline-block" />
            <div className="flex-1 min-w-0 flex flex-wrap gap-x-3 gap-y-1 break-words [overflow-wrap:anywhere]">
              {segments.map((seg, sIdx) => {
                const colonIdx = seg.indexOf(':')
                const dashEnIdx = seg.indexOf(' – ')
                const dashHyIdx = seg.indexOf(' - ')
                const equalIdx = seg.indexOf(' = ')

                let label = ''
                let value = ''
                let separator = ''

                if (colonIdx > 0 && colonIdx < 40) {
                  label = seg.slice(0, colonIdx).trim()
                  value = seg.slice(colonIdx + 1).trim()
                  separator = ':'
                } else if (dashEnIdx > 0 && dashEnIdx < 40) {
                  label = seg.slice(0, dashEnIdx).trim()
                  value = seg.slice(dashEnIdx + 3).trim()
                  separator = '–'
                } else if (dashHyIdx > 0 && dashHyIdx < 40) {
                  label = seg.slice(0, dashHyIdx).trim()
                  value = seg.slice(dashHyIdx + 3).trim()
                  separator = '-'
                } else if (equalIdx > 0 && equalIdx < 40) {
                  label = seg.slice(0, equalIdx).trim()
                  value = seg.slice(equalIdx + 3).trim()
                  separator = '='
                }

                if (label && value) {
                  const boldLabelText = label.includes('**') ? label : `**${label}**`
                  return (
                    <span key={sIdx} className="inline">
                      <span className="font-semibold text-white mr-1.5">
                        <MathFormattedText text={boldLabelText} hideBold={hideBold} /> {separator}
                      </span>
                      <span>
                        <MathFormattedText text={value} hideBold={hideBold} />
                      </span>
                    </span>
                  )
                }

                return (
                  <span key={sIdx}>
                    <MathFormattedText text={seg} hideBold={hideBold} />
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function NotesContent({ deckId }: { deckId?: string }) {
  const router = useRouter()
  const params = useParams()
  const routeDeckId = (params?.deckId as string | undefined) || ''
  const urlDeckId = typeof window !== 'undefined'
    ? (window.location.pathname.split('/study/')[1]?.split('/')[0]?.split('?')[0] || '')
    : ''
  const storedDeckId = typeof window !== 'undefined'
    ? (localStorage.getItem('studyup_active_deck_id') || '')
    : ''

  const effectiveDeckId = (deckId && deckId !== '_offline')
    ? deckId
    : (routeDeckId && routeDeckId !== '_offline')
      ? routeDeckId
      : (urlDeckId && urlDeckId !== '_offline')
        ? urlDeckId
        : storedDeckId
  const { status, currentItemId, startQueue, stop } = useTTS()
  const [deck, setDeck] = useState<Deck | null>(null)
  const [keywords, setKeywords] = useState<Card[]>([])
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [revealAll, setRevealAll] = useState(true)
  const [hideBoldKeywords, setHideBoldKeywords] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!effectiveDeckId) {
        setLoading(false)
        return
      }
      try {
        const [d, allCards] = await Promise.all([getDeck(effectiveDeckId), getCardsByDeck(effectiveDeckId)])
        setDeck(d ?? null)

        const isTableContent = (c: Card) =>
          /&\[\s*table/i.test(c.front || '') ||
          /&\[\s*table/i.test(c.back || '') ||
          /(?:^|\n)\|.+?\|.+?\|(?:\n|$)/.test(c.front || '') ||
          /(?:^|\n)\|.+?\|.+?\|(?:\n|$)/.test(c.back || '')

        // Look for keyword cards or any cards containing tables, fallback to definition cards if no keyword/table cards exist
        const kwOrTable = allCards.filter(c => c.type === 'keyword' || isTableContent(c))
        const rawTargetCards = kwOrTable.length > 0 ? kwOrTable : allCards.filter(c => c.type === 'definition' || c.type === 'concept')

        // Permanent 100% exact Note Deduplication on load (deletes forever in IndexedDB and backend only when 100% identical)
        const seenNoteKeys = new Set<string>()
        const dupNoteIds: string[] = []
        const targetCards: Card[] = []

        for (const c of rawTargetCards) {
          const cleanFront = normalizeTextForDedup(c.front)
          const cleanBack = normalizeTextForDedup(c.back)
          const pairKey = `${c.type}:::${cleanFront}:::${cleanBack}`

          if (seenNoteKeys.has(pairKey)) {
            dupNoteIds.push(c.id)
            continue
          }
          seenNoteKeys.add(pairKey)
          targetCards.push(c)
        }

        if (dupNoteIds.length > 0) {
          await bulkDeleteCards(dupNoteIds).catch(() => {})
          if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine) {
            (async () => {
              try {
                const headers = await getAuthHeaders({ 'Content-Type': 'application/json' })
                fetch('/api/decks/deduplicate', {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ deckId: effectiveDeckId, title: d?.title }),
                }).catch(() => {})
              } catch {}
            })()
          }
        }

        // Semantic ordering: Table data first, then definitions/core concepts, then enumerations at bottom of topic
        const isEnumCard = (c: Card) => {
          const t = (c.type as string).toLowerCase()
          return t === 'enumeration' || t === 'enum' || c.front.includes('(Key Concepts)')
        }

        targetCards.sort((a, b) => {
          // 1. Table data first
          const aTable = isTableContent(a) ? 0 : 1
          const bTable = isTableContent(b) ? 0 : 1
          if (aTable !== bTable) return aTable - bTable

          // 2. Enumeration at the bottom of the section
          const aEnum = isEnumCard(a) ? 1 : 0
          const bEnum = isEnumCard(b) ? 1 : 0
          if (aEnum !== bEnum) return aEnum - bEnum

          const isMiscCard = (c: Card) => {
            const text = `${c.front} ${c.chapter || ''}`.toLowerCase()
            return text.includes('miscellaneous') || text.includes('overview')
          }
          const aMisc = isMiscCard(a) ? 1 : 0
          const bMisc = isMiscCard(b) ? 1 : 0
          if (aMisc !== bMisc) return aMisc - bMisc

          return 0
        })

        setKeywords(targetCards)
        setRevealed(new Set(targetCards.map(c => c.id)))
      } catch (err) {
        console.warn('Failed to load notes:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [effectiveDeckId])

  const toggleReveal = (id: string) => {
    setRevealed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleRevealAll = () => {
    if (revealAll) {
      setRevealed(new Set())
      setRevealAll(false)
    } else {
      setRevealed(new Set(keywords.map(c => c.id)))
      setRevealAll(true)
    }
  }

  const toggleHideBoldKeywords = () => {
    setHideBoldKeywords(prev => !prev)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return keywords
    const q = search.toLowerCase()
    return keywords.filter(
      c =>
        c.front.toLowerCase().includes(q) ||
        c.back.toLowerCase().includes(q) ||
        (c.chapter && c.chapter.toLowerCase().includes(q))
    )
  }, [keywords, search])

  // Group by chapter
  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, Card[]>>((acc, card) => {
      const ch = card.chapter || 'Notes'
      if (!acc[ch]) acc[ch] = []
      acc[ch].push(card)
      return acc
    }, {})
  }, [filtered])

  const parseNoteToSpeechText = (card: Card): string => {
    const blocks: BackBlock[] =
      (card as any).back_blocks &&
      Array.isArray((card as any).back_blocks) &&
      (card as any).back_blocks.length > 0
        ? (card as any).back_blocks
        : parseRawNoteToBlocks(card.back, card.front)

    if (blocks && blocks.length > 0) {
      const parts: string[] = []
      for (const b of blocks) {
        if (b.kind === 'definition') {
          const term = (b.term || '').replace(/[*_`]/g, '').trim()
          const text = (b.text || '').replace(/[*_`]/g, '').trim()
          if (term && text) parts.push(`${term}: ${text}.`)
          else if (term || text) parts.push(`${term || text}.`)
        } else if (b.kind === 'steps') {
          const label = b.label ? `${b.label}: ` : ''
          const items = (b.items || []).map((it, idx) => `Step ${idx + 1}, ${it.replace(/[*_`]/g, '').trim()}.`).join(' ')
          if (items) parts.push(`${label}${items}`)
        } else if (b.kind === 'table') {
          const tableSpeech = tableToSpeech(b.columns || [], b.rows || [], b.label)
          if (tableSpeech) parts.push(tableSpeech)
        } else if (b.kind === 'formula' || b.kind === 'example' || b.kind === 'note') {
          const text = (b.text || '').replace(/[*_`]/g, '').trim()
          if (text) {
            const prefix = ('label' in b && b.label) ? `${b.label}: ` : ''
            parts.push(`${prefix}${text}.`)
          }
        } else if ((b as any).kind === 'pros_cons') {
          const pros = (((b as any).pros || []) as string[]).map((p: string) => p.replace(/[*_`]/g, '').trim()).filter(Boolean)
          const cons = (((b as any).cons || []) as string[]).map((c: string) => c.replace(/[*_`]/g, '').trim()).filter(Boolean)
          if (pros.length > 0) parts.push(`Advantages: ${pros.join('. ')}.`)
          if (cons.length > 0) parts.push(`Disadvantages: ${cons.join('. ')}.`)
        }
      }
      if (parts.length > 0) {
        return parts.join(' ')
      }
    }

    return card.back || ''
  }

  // TTS read aloud single note with table pauses
  const handleSpeakSingleNote = (e: React.MouseEvent, card: Card) => {
    e.stopPropagation()
    if (status !== 'idle' && currentItemId === card.id) {
      stop()
      return
    }

    const cleanFront = card.front.replace(/[\*\#\_\`]/g, '').trim()
    const speechBack = parseNoteToSpeechText(card)
    startQueue([{ id: card.id, title: cleanFront, backText: speechBack }])
  }

  // TTS read aloud all notes in order with table pauses
  const toggleReadAloudAll = () => {
    if (status !== 'idle') {
      stop()
      return
    }
    const queue = filtered.map(c => {
      const cleanFront = c.front.replace(/[\*\#\_\`]/g, '').trim()
      const speechBack = parseNoteToSpeechText(c)
      return { id: c.id, title: cleanFront, backText: speechBack }
    })
    if (queue.length > 0) {
      startQueue(queue)
    }
  }

  if (loading) {
    return (
      <div className="h-[100dvh] bg-[#0b0c14] flex flex-col px-4 pt-2 pb-6 max-w-[520px] mx-auto w-full">
        <StudyHeader onClose={() => router.push('/study/' + effectiveDeckId)} percent={10} />
        <div className="space-y-4 pt-6 animate-pulse">
          <div className="h-10 bg-[#151722] rounded-[12px] border border-[#222536]" />
          <div className="h-4 w-28 bg-[#151722] rounded" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 border-b border-[#222536] py-3 flex flex-col justify-center">
                <div className="h-4 bg-[#151722] rounded w-3/4 mb-1.5" />
                <div className="h-3 bg-[#151722] rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b0c14] text-white flex flex-col max-w-[520px] mx-auto w-full pb-16">
      {/* Gold standard StudyHeader with bare icons */}
      <StudyHeader
        onClose={() => {
          stop()
          router.push('/study/' + effectiveDeckId)
        }}
        closeIcon="back"
        percent={100}
        rightSlot={
          <div className="flex items-center gap-1">
            <HeaderIconButton
              onClick={toggleReadAloudAll}
              title={status !== 'idle' ? 'Stop read aloud' : 'Read aloud all notes'}
            >
              {status !== 'idle' ? <VolumeX size={18} className="text-[#ff5252]" /> : <Volume2 size={18} />}
            </HeaderIconButton>
            <ExportButton deckId={effectiveDeckId} deckTitle={deck?.title ?? 'Notes'} variant="icon" />
          </div>
        }
      />

      {/* Surface Toolbar: Search Input + Bold Clickable Text Actions (Rule 4e: no fill, no outline) */}
      <div className="px-4 pt-2 pb-3 space-y-3">
        {/* Search Input sitting on surface */}
        <div className="relative w-full">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8e92a8] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search keywords, topics, formulas…"
            className="w-full pl-9 pr-8 py-2.5 rounded-[12px] bg-[#151722] border border-[#222536] text-[14px] text-white placeholder:text-[#8e92a8] focus:outline-none focus:border-[#7e57ff] transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8e92a8] hover:text-white p-1"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Secondary Action Links: Rule 4e (bold text, no box, no fill, no outline) */}
        <div className="flex items-center justify-between text-[13px] px-1">
          <button
            type="button"
            onClick={toggleHideBoldKeywords}
            className="font-bold text-[#8e92a8] hover:text-[#9d7eff] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Tag size={14} className={hideBoldKeywords ? 'text-[#7e57ff]' : ''} />
            <span>{hideBoldKeywords ? 'Show Keywords' : 'Mask Keywords'}</span>
          </button>

          <button
            type="button"
            onClick={toggleRevealAll}
            className="font-bold text-[#8e92a8] hover:text-[#9d7eff] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {revealAll ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{revealAll ? 'Collapse All' : 'Expand All'}</span>
          </button>
        </div>
      </div>

      {/* Notes List (RULE 4 & 11: Text and lists sit directly on the surface, NO card divs) */}
      <div className="flex-1 px-4 pt-1">
        {Object.entries(grouped).map(([chapter, cards]) => (
          <section key={chapter} className="mb-6">
            {/* Chapter Header sitting on surface */}
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-[#8e92a8] font-bold pb-2 pt-1">
              {chapter}
            </h3>

            {/* List items with subtle border divider between items */}
            <div className="divide-y divide-[#222536]">
              {cards.map(card => {
                const isCurrentlyPlaying = status !== 'idle' && currentItemId === card.id
                const isRevealed = isCurrentlyPlaying || revealed.has(card.id)

                return (
                  <div
                    key={card.id}
                    className={`py-3 transition-colors ${
                      isCurrentlyPlaying ? 'bg-[#7e57ff]/10 px-2 rounded-[10px]' : ''
                    }`}
                  >
                    {/* Header Row: Title accordion trigger + Voice Read Button */}
                    <div className="flex items-start justify-between gap-3 select-none">
                      <button
                        type="button"
                        onClick={() => toggleReveal(card.id)}
                        className="flex-1 min-w-0 flex items-start justify-between gap-2 text-left cursor-pointer group"
                      >
                        <h4 className="font-sans font-bold text-white text-[15px] sm:text-[16px] leading-snug group-hover:text-[#9d7eff] transition-colors break-words [overflow-wrap:anywhere]">
                          <MathFormattedText text={card.front} hideBold={hideBoldKeywords} />
                        </h4>
                        <ChevronDown
                          size={18}
                          className={`shrink-0 mt-0.5 text-[#8e92a8] group-hover:text-white transition-transform duration-200 ${
                            isRevealed ? 'rotate-180 text-[#7e57ff]' : ''
                          }`}
                        />
                      </button>

                      {/* Bare voice audio button */}
                      <button
                        type="button"
                        onClick={e => handleSpeakSingleNote(e, card)}
                        className={`p-1.5 rounded-full transition-colors shrink-0 ${
                          isCurrentlyPlaying
                            ? 'text-[#7e57ff] bg-[#7e57ff]/20'
                            : 'text-[#8e92a8] hover:text-white'
                        }`}
                        title={isCurrentlyPlaying ? 'Stop reading' : 'Read this note'}
                        aria-label="Read note aloud"
                      >
                        {isCurrentlyPlaying ? <VolumeX size={16} /> : <Volume2 size={16} />}
                      </button>
                    </div>

                    {/* Revealed note content sitting directly on the surface */}
                    {isRevealed && (
                      <div className="pt-2.5 pb-1 text-[#cbd5e1] leading-relaxed">
                        <FormattedNoteText text={card.back} hideBold={hideBoldKeywords} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        {/* Empty state per Rule 7 */}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[15px] font-bold text-white mb-1">No notes match &ldquo;{search}&rdquo;</p>
            <p className="text-[13px] text-[#8e92a8] mb-4">Check for typos or try searching another keyword.</p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-[14px] font-extrabold text-[#9d7eff] hover:text-white transition-colors cursor-pointer"
            >
              Clear search &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NotesClient({ deckId }: { deckId?: string }) {
  return <NotesContent deckId={deckId} />
}
