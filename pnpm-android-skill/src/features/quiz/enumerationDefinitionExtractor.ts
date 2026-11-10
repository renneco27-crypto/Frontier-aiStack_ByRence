import type { Card, Deck } from '@/lib/zodSchemas'

/**
 * Pure client-side definition extractor for Enumeration answers.
 * Zero external dependencies, zero AI, runs offline in 0ms.
 *
 * Algorithm Hierarchy:
 * 1. Checks length: If answer has 4 or more words, returns null (caller speaks answer only).
 * 2. Checks Deck Notes / structured back_blocks (table rows, definitional patterns, copular verbs).
 * 3. Checks Flashcards (card.front matches term -> card.back is definition).
 * 4. Fallback: returns null (caller speaks answer only).
 */
export function findEnumerationDefinition(
  term: string,
  deck: Deck | null,
  cards: Card[] = []
): string | null {
  if (!term || typeof term !== 'string') return null
  const words = term.trim().split(/\s+/).filter(Boolean)
  // Per requirement: only look up if answer is less than 4 words long
  if (words.length >= 4 || words.length === 0) return null

  const cleanTerm = term.trim().toLowerCase().replace(/[;,\.\(\)]+/g, '')
  if (!cleanTerm) return null

  // Escape special regex characters
  const escTerm = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // 1. Search in Deck Notes / sourceJson back_blocks (Highest fidelity for Notes Deck)
  if (deck?.sourceJson) {
    try {
      const raw = JSON.parse(deck.sourceJson)
      const rawCards = Array.isArray(raw) ? raw : (Array.isArray(raw.cards) ? raw.cards : [])
      for (const rc of rawCards) {
        if (Array.isArray(rc.back_blocks)) {
          for (const bb of rc.back_blocks) {
            if (bb && typeof bb === 'object') {
              const bTerm = String(bb.term || '').trim().toLowerCase()
              if (bTerm === cleanTerm && bb.text) {
                return cleanDefinitionSentence(String(bb.text), term)
              }
            }
          }
        }
      }
    } catch {}
  }

  // 2. Gather all note text from keyword cards & transcripts
  const noteTexts: string[] = []
  if (deck?.transcripts) {
    for (const tr of deck.transcripts) {
      if (tr.text) noteTexts.push(tr.text)
    }
  }
  for (const c of cards) {
    if (c.type === 'keyword' && c.back) {
      noteTexts.push(c.back)
    }
  }

  // 3. Search Markdown Tables in Notes
  for (const block of noteTexts) {
    const lines = block.split(/\r?\n/)
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
        const cells = trimmedLine
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean)
        if (cells.length >= 2) {
          const termIdx = cells.findIndex((cell) => cell.toLowerCase().replace(/[*_`]/g, '').trim() === cleanTerm)
          if (termIdx !== -1) {
            const defIdx = termIdx === 0 ? 1 : 0
            const defCell = cells[defIdx].replace(/[*_`]/g, '').trim()
            if (defCell.length > 5 && !defCell.toLowerCase().includes('term') && !defCell.toLowerCase().includes('description')) {
              return cleanDefinitionSentence(defCell, term)
            }
          }
        }
      }
    }
  }

  // 4. Search Definitional Patterns in Notes (e.g. "Term: Definition", "Term - Definition", "Term is/are...")
  const defPatternRegex = new RegExp(
    `^(?:[-*•\\d.)\\s]*)(?:\\*\\*|__)?${escTerm}(?:\\*\\*|__)?\\s*(?:[:–—\\-]|\\s+(?:is|are|refers to|means|defines|is defined as|represents))\\s+(.+)`,
    'im'
  )

  for (const block of noteTexts) {
    const lines = block.split(/\r?\n/)
    for (const line of lines) {
      const match = line.match(defPatternRegex)
      if (match && match[1]) {
        const candidate = match[1].replace(/[*_`]/g, '').trim()
        if (candidate.length > 5) {
          return cleanDefinitionSentence(candidate, term)
        }
      }
    }
  }

  // 5. Search Sentence-Level Copular Sentences in Notes
  for (const block of noteTexts) {
    const sentences = block.split(/(?<=[.!?])\s+(?=[A-Z0-9])|\n+/)
    for (const sentence of sentences) {
      const s = sentence.replace(/[*_`#]/g, '').trim()
      if (!s) continue
      const sLower = s.toLowerCase()
      const copularMatch = sLower.match(new RegExp(`\\b${escTerm}\\b\\s+(?:is|are|refers to|means|defined as)\\b`))
      if (copularMatch) {
        return cleanDefinitionSentence(s, term)
      }
    }
  }

  // 6. Search Flashcards (card.front matches term -> card.back is definition)
  for (const c of cards) {
    if (c.type === 'definition' || !c.type) {
      const fLower = c.front.trim().toLowerCase()
      if (
        fLower === cleanTerm ||
        fLower === `what is ${cleanTerm}?` ||
        fLower === `what is a ${cleanTerm}?` ||
        fLower === `what is an ${cleanTerm}?` ||
        fLower === `what are ${cleanTerm}?` ||
        fLower === `${cleanTerm} definition`
      ) {
        if (c.back && c.back.trim().length > 3) {
          return cleanDefinitionSentence(c.back, term)
        }
      }
    }
  }

  // 7. Looser Flashcard Front Containment (if front starts with "What is <term>")
  for (const c of cards) {
    const fLower = c.front.trim().toLowerCase()
    if (fLower.includes(cleanTerm) && (c.back && c.back.trim().length > 3)) {
      if (fLower.startsWith('what is') || fLower.startsWith('what are') || fLower.startsWith(cleanTerm)) {
        return cleanDefinitionSentence(c.back, term)
      }
    }
  }

  return null
}

export function cleanDefinitionSentence(raw: string, _term: string): string {
  let cleaned = raw
    .replace(/^[:–—\-]\s*/, '')
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Truncate to maximum 2 sentences for natural TTS flow
  const sentenceParts = cleaned.split(/(?<=[.!?])\s+/)
  if (sentenceParts.length > 2) {
    cleaned = sentenceParts.slice(0, 2).join(' ')
  }

  if (!cleaned.endsWith('.') && !cleaned.endsWith('!') && !cleaned.endsWith('?')) {
    cleaned += '.'
  }

  return cleaned
}

function normalizeKey(str: string): string {
  return (str || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 100)
}

// In-flight request deduplication map to prevent multiple concurrent requests for the same term
const inFlightRequests = new Map<string, Promise<string | null>>()

/**
 * Retrieves a cached AI definition from the local database.
 * Fast, synchronous, 100% offline-ready.
 */
export function getCachedAiDefinition(
  deckId: string,
  topic: string,
  term: string
): string | null {
  if (typeof window === 'undefined') return null
  const normTerm = normalizeKey(term)
  if (!normTerm) return null
  const normTopic = normalizeKey(topic)
  const normDeck = normalizeKey(deckId)

  const candidates: string[] = []
  if (normDeck && normDeck !== 'global' && normDeck !== 'offline') {
    candidates.push(`studyup_enum_def_${normDeck}_${normTopic}_${normTerm}`)
  }
  if (normTopic) {
    candidates.push(`studyup_enum_def_${normTopic}_${normTerm}`)
  }
  candidates.push(`studyup_enum_def_${normTerm}`)

  // Legacy key check for backward compatibility
  const legacyCleanTopic = (topic || '').trim().toLowerCase()
  const legacyCleanTerm = (term || '').trim().toLowerCase().replace(/[;,\.\(\)]+/g, '')
  candidates.push(`studyup_enum_def_${(deckId || 'global').trim()}_${legacyCleanTopic}_${legacyCleanTerm}`)

  for (const k of candidates) {
    try {
      const cached = localStorage.getItem(k)
      if (cached && cached.trim()) {
        return cached.trim()
      }
    } catch {}
  }
  return null
}

/**
 * Saves an AI-generated definition to the local database across topic and deck scopes.
 */
export function saveCachedAiDefinition(
  deckId: string,
  topic: string,
  term: string,
  definition: string
): void {
  if (typeof window === 'undefined') return
  const normTerm = normalizeKey(term)
  if (!normTerm || !definition) return
  const normTopic = normalizeKey(topic)
  const normDeck = normalizeKey(deckId)
  const val = definition.trim()

  try {
    if (normTopic) {
      localStorage.setItem(`studyup_enum_def_${normTopic}_${normTerm}`, val)
    }
    if (normDeck && normDeck !== 'global' && normDeck !== 'offline') {
      localStorage.setItem(`studyup_enum_def_${normDeck}_${normTopic}_${normTerm}`, val)
    }
    localStorage.setItem(`studyup_enum_def_${normTerm}`, val)
  } catch {}
}

/**
 * Fetches definition from AI (the same AI engine as AISidebar) if not in notes deck.
 * Deduplicates in-flight calls and saves to local database so subsequent presses retrieve it instantly without AI.
 */
export async function fetchAiDefinition(
  deckId: string,
  topic: string,
  term: string
): Promise<string | null> {
  if (!term || typeof term !== 'string') return null

  // 1. Check local database cache first ("and when pressed just calls it")
  const cached = getCachedAiDefinition(deckId, topic, term)
  if (cached) return cached

  const normTopic = normalizeKey(topic)
  const normTerm = normalizeKey(term)
  const inFlightKey = `${normTopic}_${normTerm}`

  if (inFlightRequests.has(inFlightKey)) {
    return inFlightRequests.get(inFlightKey)!
  }

  const reqPromise = (async () => {
    try {
      const { getAuthHeaders } = await import('@/lib/supabase')
      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' }).catch(
        () => ({ 'Content-Type': 'application/json' })
      )

      const res = await fetch('/api/lab/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          kind: 'enumeration',
          deckId: deckId || 'default',
          messages: [
            {
              role: 'user',
              content: `Define or explain the item "${term}" under the topic "${topic}". Keep it to 1 to 2 clear sentences under 35 words. Do not use emojis.`,
            },
          ],
          screenContext: {
            screen: 'enumeration',
            topic: topic || 'General Topic',
          },
        }),
      })

      if (!res.ok) return null
      const data = await res.json()
      const reply = (data?.reply || '').trim()
      if (!reply) return null

      const cleaned = cleanDefinitionSentence(reply, term)
      if (cleaned) {
        saveCachedAiDefinition(deckId, topic, term, cleaned)
        return cleaned
      }
    } catch (err) {
      console.warn('[enumerationDefinitionExtractor] AI definition request failed:', err)
    } finally {
      inFlightRequests.delete(inFlightKey)
    }
    return null
  })()

  inFlightRequests.set(inFlightKey, reqPromise)
  return reqPromise
}
