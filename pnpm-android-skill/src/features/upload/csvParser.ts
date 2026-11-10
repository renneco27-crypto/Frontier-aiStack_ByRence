import type { Deck, Card, QuizItem } from '@/lib/zodSchemas'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CSVRow {
  front: string
  back: string
  chapter: string
  subject: string
  lesson: string
  type: string
  mc_correct?: string
  mc_distractor1?: string
  mc_distractor2?: string
  mc_distractor3?: string
  tf_answer?: string
  explanation?: string
  enum_items?: string
  id_answer?: string
  id_variants?: string
  // ── Coding IDE columns ──────────────────────────────────────────────────────
  code_language?: string      // java | python | sql | javascript
  code_starter?: string       // starter template shown in IDE
  code_keywords?: string      // semicolon-separated keywords that must appear (e.g. "int[];drawer;for")
  code_solution?: string      // the correct/expected solution (Claude's answer)
  code_output?: string        // simulated console output shown on success
  // ── Math Lab columns ────────────────────────────────────────────────────────
  math_problem?: string       // LaTeX of the problem expression, e.g. "3x + 9 = 24"
  math_answer?: string        // plain final answer shown for checking, e.g. "x = 5"
  math_category?: string      // Algebra | Fractions & Cancellation | Quadratic Equations | etc.
  math_difficulty?: string    // Beginner | Intermediate | Advanced
  math_steps?: string         // steps encoded as: "latex|explanation|operationType|badge ; latex|..."
                              // operationType: start|add_sub|mul_div|cancel|substitute|factor|simplify|final
}

// Types that should appear in flashcard mode (have a readable front/back)
const FLASHCARD_TYPES = new Set(['definition', 'concept', 'formula', 'process', 'list',
  'multiple_choice', 'mc', 'true_false', 'tf', 'enumeration', 'enum', 'identification', 'id',
  'code', 'code_challenge', 'math', 'math_problem'])

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current.trim())
  return result
}

function splitCSVRows(text: string): string[] {
  const rows: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '""'
        i++
      } else {
        inQuotes = !inQuotes
        cur += '"'
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      if (cur.trim()) rows.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) rows.push(cur.trim())
  return rows
}

function parseCSV(text: string): CSVRow[] {
  const cleanText = text.replace(/^\uFEFF/, '').trim()
  const lines = splitCSVRows(cleanText)

  if (lines.length < 2) return []

  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim())
  const rows: CSVRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    header.forEach((key, idx) => {
      row[key] = (values[idx] ?? '').trim()
    })

    rows.push({
      front:         row.front          ?? '',
      back:          row.back           ?? '',
      chapter:       row.chapter        ?? '',
      subject:       row.subject        ?? '',
      lesson:        row.lesson         ?? '',
      type:          row.type           ?? 'definition',
      mc_correct:    row.mc_correct     ?? row.mc_correct_answer  ?? '',
      mc_distractor1:row.mc_distractor1 ?? row.mc_distractor_1   ?? '',
      mc_distractor2:row.mc_distractor2 ?? row.mc_distractor_2   ?? '',
      mc_distractor3:row.mc_distractor3 ?? row.mc_distractor_3   ?? '',
      tf_answer:     row.tf_answer      ?? row.true_false         ?? '',
      explanation:   row.explanation    ?? row.tf_explanation     ?? '',
      enum_items:    row.enum_items     ?? row.enumeration_items  ?? '',
      id_answer:     row.id_answer      ?? row.identification_answer   ?? '',
      id_variants:   row.id_variants    ?? row.identification_variants ?? '',
      // Coding IDE columns
      code_language: row.code_language  ?? '',
      code_starter:  row.code_starter   ?? '',
      code_keywords: row.code_keywords  ?? '',
      code_solution: row.code_solution  ?? '',
      code_output:   row.code_output    ?? '',
      // Math Lab columns
      math_problem:    row.math_problem    ?? '',
      math_answer:     row.math_answer     ?? '',
      math_category:   row.math_category   ?? '',
      math_difficulty: row.math_difficulty ?? '',
      math_steps:      row.math_steps      ?? '',
    })
  }

  return rows
}

// ─── Back-field resolver ──────────────────────────────────────────────────────
/**
 * For flashcard display, every card needs a readable "back".
 * Resolve it from whichever type-specific field has the real answer.
 * Returns null if the row should NOT appear as a flashcard at all.
 */
function resolveBack(row: CSVRow): string | null {
  const type = row.type.toLowerCase().trim()

  switch (type) {
    case 'multiple_choice':
    case 'mc':
      return row.mc_correct || row.back || null

    case 'true_false':
    case 'tf': {
      const answer = (row.tf_answer || row.back).toLowerCase().trim()
      if (!answer) return null
      const isTrue = answer === 'true' || answer === 't' || answer === 'yes'
      return isTrue ? 'True' : 'False'
    }

    case 'enumeration':
    case 'enum': {
      const raw = row.enum_items || row.back
      if (!raw) return null
      const items = raw.split(';').map(s => s.trim()).filter(Boolean)
      return items.length >= 2 ? items.join(', ') : null
    }

    case 'identification':
    case 'id':
      return row.id_answer || row.back || null

    case 'code':
    case 'code_challenge':
      return row.code_solution || row.back || null

    case 'math':
    case 'math_problem':
      return row.math_answer || row.back || null

    default:
      return row.back || null
  }
}

// ─── Card builder ─────────────────────────────────────────────────────────────
/**
 * Only creates a Card for rows that have a valid front AND a resolvable back.
 * Quiz-only rows still get a card (for review mode) but are never shown
 * in the plain flashcard stack — the UI checks `card.type` to decide that.
 */
function buildCards(rows: CSVRow[], deckId: string, primarySubject: string): Card[] {
  const cards: Card[] = []

  rows.forEach((row, i) => {
    const front = row.front?.trim()
    if (!front) return

    const type = row.type.toLowerCase().trim()

    // True/False is quiz-only — never create a flashcard card for it
    if (type === 'true_false' || type === 'tf') return

    const back = resolveBack(row)
    if (!back) return

    // System-wide rule: Tables always go to Notes, never to flashcards
    const hasTableDirective = (text: string) =>
      /&\[\s*table\s*:/i.test(text) || /(?:^|\n)\|.+?\|.+?\|(?:\n|$)/.test(text)
    const containsTable = hasTableDirective(front) || hasTableDirective(back)

    let cardType = (
      ['definition', 'concept', 'formula', 'process', 'list', 'keyword',
       'multiple_choice', 'true_false', 'enumeration', 'identification',
       'code', 'code_challenge', 'math', 'math_problem'].includes(type)
        ? type
        : 'definition'
    ) as Card['type']

    if (containsTable && cardType !== 'keyword') {
      cardType = 'keyword'
    }

    cards.push({
      id:           `card-csv-${Date.now()}-${i}`,
      deckId,
      front,
      back,
      chapter:      row.chapter || '',
      subject:      row.subject || primarySubject,
      lesson:       row.lesson  || '',
      type:         cardType,
      mastery:      0,
      status:       'new' as const,
      know:         null,
      correctCount: 0,
      wrongCount:   0,
      lastReviewed: null,
      nextReview:   null,
      mc_correct:     row.mc_correct || '',
      mc_distractor1: row.mc_distractor1 || '',
      mc_distractor2: row.mc_distractor2 || '',
      mc_distractor3: row.mc_distractor3 || '',
      tf_answer:      row.tf_answer || '',
      enum_items:     row.enum_items || '',
      id_answer:      row.id_answer || '',
      id_variants:    row.id_variants || '',
      code_language:  row.code_language || '',
      code_starter:   row.code_starter || '',
      code_keywords:  row.code_keywords || '',
      code_solution:  row.code_solution || '',
      code_output:    row.code_output || '',
      math_problem:    row.math_problem || '',
      math_answer:     row.math_answer || '',
      math_category:   row.math_category || '',
      math_difficulty: row.math_difficulty || '',
      math_steps:      row.math_steps || '',
    })
  })

  return cards
}

// ─── Quiz item builder ────────────────────────────────────────────────────────

function generateQuizItems(rows: CSVRow[], primarySubject: string): QuizItem[] {
  const quizItems: QuizItem[] = []

  for (const row of rows) {
    const chapter = row.chapter || 'General'
    const subject = row.subject || primarySubject
    const type    = row.type.toLowerCase().trim()

    // ── Multiple Choice ───────────────────────────────────────────────────────
    if (type === 'multiple_choice' || type === 'mc') {
      const correct     = row.mc_correct || row.back
      const distractors = [row.mc_distractor1, row.mc_distractor2, row.mc_distractor3]
        .filter((d): d is string => !!d?.trim())

      if (correct && distractors.length === 3) {
        quizItems.push({
          mode:        'multiple_choice',
          question:    row.front,
          correct,
          distractors,
          chapter,
          subject,
        })
      } else {
        console.warn(`[csvParser] Skipping MC row — missing correct answer or distractors: "${row.front}"`)
      }
    }

    // ── True / False ──────────────────────────────────────────────────────────
    if (type === 'true_false' || type === 'tf') {
      const raw    = (row.tf_answer || row.back).toLowerCase().trim()
      const isTrue = raw === 'true' || raw === 't' || raw === 'yes' || raw === 'y'

      if (!raw) {
        console.warn(`[csvParser] Skipping TF row — no tf_answer: "${row.front}"`)
        continue
      }

      quizItems.push({
        mode:         'true_false',
        statement:    row.front,
        falseVersion: row.front,
        explanation:  row.explanation || (isTrue ? 'This statement is true.' : 'This statement is false.'),
        correct:      isTrue,
        chapter,
        subject,
      })
    }

    // ── Enumeration ───────────────────────────────────────────────────────────
    if (type === 'enumeration' || type === 'enum') {
      // Fallback: if enum_items is empty but id_variants has content, the CSV
      // row probably has too many commas shifting data right by one column.
      const raw = row.enum_items || row.id_variants || row.back
      if (!raw) {
        console.warn(`[csvParser] Skipping enumeration row — no enum_items: "${row.front}"`)
        continue
      }

      const items = raw
        .split(';')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)

      // Guard: must have at least 2 items to be a real enumeration
      if (items.length < 2) {
        console.warn(`[csvParser] Skipping enumeration row — fewer than 2 items (${items.length}): "${row.front}"`)
        continue
      }

      quizItems.push({
        mode:    'enumeration',
        topic:   row.front,
        items,
        chapter,
        subject,
      })
    }

    // ── Identification ────────────────────────────────────────────────────────
    if (type === 'identification' || type === 'id') {
      const answer = row.id_answer || (row.id_variants ? row.id_variants.split(';')[0]?.trim() : '') || row.back
      if (!answer) {
        console.warn(`[csvParser] Skipping identification row — no id_answer: "${row.front}"`)
        continue
      }

      const variants = row.id_variants
        ? row.id_variants.split(';').map(s => s.trim()).filter(Boolean)
        : [answer.toLowerCase()]

      quizItems.push({
        mode:           'identification',
        definition:     row.front,
        answer,
        acceptVariants: variants,
        chapter,
        subject,
      })
    }

    // ── Definition / Keyword (only if id_answer is explicitly specified for keywords) ───
    if (type === 'definition' || (type === 'keyword' && row.id_answer)) {
      const answer = row.id_answer || (row.id_variants ? row.id_variants.split(';')[0]?.trim() : '') || row.back
      if (!answer) {
        console.warn(`[csvParser] Skipping definition row — no answer: "${row.front}"`)
        continue
      }

      const variants = row.id_variants
        ? row.id_variants.split(';').map(s => s.trim()).filter(Boolean)
        : [answer.toLowerCase().trim()]

      quizItems.push({
        mode:           'identification',
        definition:     row.front,
        answer,
        acceptVariants: variants,
        chapter,
        subject,
      })
    }

    // ── Math / Math Problem ───────────────────────────────────────────────────
    if (type === 'math' || type === 'math_problem') {
      const definition = row.math_problem || row.front
      const answer = row.math_answer || row.back || row.id_answer || (row.id_variants ? row.id_variants.split(';')[0]?.trim() : '')
      if (!definition || !answer) {
        console.warn(`[csvParser] Skipping math row — missing problem or answer: "${row.front}"`)
        continue
      }

      const variants = row.id_variants
        ? row.id_variants.split(';').map(s => s.trim()).filter(Boolean)
        : [answer.toLowerCase().trim()]

      quizItems.push({
        mode:           'identification',
        definition,
        answer,
        acceptVariants: variants,
        chapter,
        subject,
      })
    }

    // ── Code / Code Challenge ─────────────────────────────────────────────────
    if (type === 'code' || type === 'code_challenge') {
      const definition = row.code_starter
        ? `${row.front}\n\`\`\`${row.code_language || ''}\n${row.code_starter}\n\`\`\``
        : row.front
      const answer = row.code_solution || row.code_output || row.back || row.id_answer || (row.id_variants ? row.id_variants.split(';')[0]?.trim() : '')
      if (!definition || !answer) {
        console.warn(`[csvParser] Skipping code row — missing prompt or solution: "${row.front}"`)
        continue
      }

      const variants = row.id_variants
        ? row.id_variants.split(';').map(s => s.trim()).filter(Boolean)
        : [answer.toLowerCase().trim()]

      quizItems.push({
        mode:           'identification',
        definition,
        answer,
        acceptVariants: variants,
        chapter,
        subject,
      })
    }

    // ── Fallback for other card types ─────────────────────────────────────────
    const handledTypes = [
      'multiple_choice', 'mc',
      'true_false', 'tf',
      'enumeration', 'enum',
      'identification', 'id',
      'definition', 'keyword',
      'math', 'math_problem',
      'code', 'code_challenge'
    ]
    if (!handledTypes.includes(type)) {
      const answer = row.id_answer || row.back || row.mc_correct || row.math_answer || row.code_solution
      if (row.front && answer) {
        const variants = row.id_variants
          ? row.id_variants.split(';').map(s => s.trim()).filter(Boolean)
          : [answer.toLowerCase().trim()]

        quizItems.push({
          mode:           'identification',
          definition:     row.front,
          answer,
          acceptVariants: variants,
          chapter,
          subject,
        })
      }
    }
  }

  return quizItems
}

const PUBLISH_CSV_HEADER = 'front,back,chapter,subject,lesson,type,mc_correct,mc_distractor1,mc_distractor2,mc_distractor3,tf_answer,explanation,enum_items,id_answer,id_variants,code_language,code_starter,code_keywords,code_solution,code_output,math_problem,math_answer,math_category,math_difficulty,math_steps'

function csvEscape(value: string): string {
  const s = value ?? ''
  return s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function flashcardAnswerKey(row: CSVRow): string {
  const t = row.type.toLowerCase().trim()
  if (t === 'keyword' || t === 'true_false' || t === 'tf') return ''
  return (row.back || row.mc_correct || row.id_answer || row.enum_items || row.code_solution || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function rowToCsvLine(row: CSVRow): string {
  return [
    row.front, row.back, row.chapter, row.subject, row.lesson, row.type,
    row.mc_correct ?? '', row.mc_distractor1 ?? '', row.mc_distractor2 ?? '', row.mc_distractor3 ?? '',
    row.tf_answer ?? '', row.explanation ?? '', row.enum_items ?? '', row.id_answer ?? '', row.id_variants ?? '',
    row.code_language ?? '', row.code_starter ?? '', row.code_keywords ?? '', row.code_solution ?? '', row.code_output ?? '',
    row.math_problem ?? '', row.math_answer ?? '', row.math_category ?? '', row.math_difficulty ?? '', row.math_steps ?? '',
  ].map(csvEscape).join(',')
}

/** Keep existing rows, then append incoming ones, dropping flashcards with the same answer. */
export function mergeDeckCsv(existing: string, incoming: string): string {
  const prior = parseCSV(existing)
  const next = parseCSV(incoming)
  const seen = new Set<string>()
  const out: CSVRow[] = []
  for (const row of [...prior, ...next]) {
    const key = flashcardAnswerKey(row)
    if (key) {
      if (seen.has(key)) continue
      seen.add(key)
    }
    out.push(row)
  }
  return [PUBLISH_CSV_HEADER, ...out.map(rowToCsvLine)].join('\n')
}

// ─── Public API ───────────────────────────────────────────────────────────────

function cleanDeckTitle(raw: string): string {
  if (!raw) return ''
  let t = raw.trim()
  // Strip prompt echo markers
  t = t.replace(/---+[\s\S]*?(?:REFERENCE MATERIAL|STUDY NOTES)[\s\S]*?---+/gi, '')
  t = t.replace(/TOPIC:\s*/gi, '')
  t = t.replace(/REFERENCE STUDY NOTES:\s*/gi, '')
  
  // Clean conversational preambles e.g. "Sure! Here are 20 interesting facts about plants 🌱:" -> "Plants"
  t = t.replace(/^(?:Sure(?:!|,|\.)?\s*)?(?:Here (?:are|is)\s+(?:\d+\s+)?(?:interesting\s+|key\s+|important\s+)?(?:facts?|notes?|details?|points?)\s+about\s+)/i, '')
  t = t.replace(/^(?:Certainly(?:!|,|\.)?\s*)/i, '')
  
  // Remove emojis and leading/trailing punctuation/colons
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
  t = t.replace(/^[\s#•\-\*:]+/, '').replace(/[\s:]+$/, '').trim()
  
  if (t.length > 0) {
    t = t.charAt(0).toUpperCase() + t.slice(1)
  }
  return t
}

export function parseCSVFile(
  text: string,
  title?: string,
  fallbackTitle?: string,
  customDeckId?: string
): { deck: Deck; cards: Card[] } {
  // Filter out any raw prompt header echoes that might have slipped into CSV
  const validRows = parseCSV(text).filter(r => {
    const f = (r.front || '').toLowerCase()
    return !f.includes('reference material') && !f.includes('reference study notes') && !f.startsWith('topic:')
  })

  const rows = validRows
  const subjects = [...new Set(rows.map(r => r.subject).filter(Boolean))]
  const primarySubject = subjects[0] ?? 'General'

  // Auto-resolve title from the first note/row title or subject/chapter if generic or unset
  let rawTitle = cleanDeckTitle(title?.trim() || '')
  const isGenericTitle = !rawTitle || 
    rawTitle === 'Untitled Deck' || 
    rawTitle === 'Study Notes Deck' || 
    rawTitle === 'Upload' ||
    rawTitle === 'Notes' ||
    rawTitle.toLowerCase().endsWith('.docx') ||
    rawTitle.toLowerCase().endsWith('.pptx') ||
    rawTitle.toLowerCase().endsWith('.pdf')

  let resolvedTitle = rawTitle

  if (isGenericTitle) {
    // 1. Highest Priority: Take the first keyword note title (front of the first keyword row)
    const firstKeywordRow = rows.find(r => r.type?.toLowerCase().trim() === 'keyword' && r.front?.trim())
    const cleanedKeywordFront = cleanDeckTitle(firstKeywordRow?.front?.trim() || '')

    if (cleanedKeywordFront && cleanedKeywordFront.length > 2) {
      resolvedTitle = cleanedKeywordFront
    } else {
      // 2. Next priority: take the first row's front title if it's a statement/topic
      const firstNonQuestion = rows.find(r => r.front?.trim() && !r.front.includes('?'))
      const cleanedNonQ = cleanDeckTitle(firstNonQuestion?.front?.trim() || '')

      if (cleanedNonQ && cleanedNonQ.length > 2) {
        resolvedTitle = cleanedNonQ
      } else if (primarySubject && primarySubject !== 'General' && primarySubject.toLowerCase() !== 'notes') {
        const chapters = [...new Set(rows.map(r => r.chapter).filter(c => c && c.toLowerCase() !== 'general'))]
        resolvedTitle = chapters[0] && !chapters[0].toLowerCase().startsWith('chapter')
          ? `${primarySubject}: ${chapters[0]}`
          : primarySubject
      } else {
        resolvedTitle = cleanDeckTitle(fallbackTitle || '') || cleanDeckTitle(rows[0]?.front?.trim() || '') || 'Study Deck'
      }
    }
  }

  const deckId     = customDeckId || `deck-csv-${Date.now()}`
  const uploadedAt = new Date().toISOString()

  // Cards: only rows with a valid front + resolvable back
  const cards = buildCards(rows, deckId, primarySubject)

  // Quiz items: structured quiz data per type
  const quizItems = generateQuizItems(rows, primarySubject)

  const deck: Deck = {
    id:          deckId,
    title:       resolvedTitle,
    subject:     primarySubject,
    uploadedAt,
    cards:       [],
    quizItems,
  }

  return { deck, cards }
}

// ─── Helper exported for UI filtering ────────────────────────────────────────
/**
 * Call this in your flashcard stack component to filter out quiz-only cards.
 * Flashcard mode should only show definition/concept/formula/process/list types.
 */
export function isFlashcardType(type: string): boolean {
  return FLASHCARD_TYPES.has(type.toLowerCase().trim())
}

/**
 * Call this in your quiz component to get only quiz-relevant cards.
 */
export function isQuizType(type: string): boolean {
  const t = type.toLowerCase().trim()
  return ['multiple_choice', 'mc', 'true_false', 'tf', 'enumeration', 'enum', 'identification', 'id'].includes(t)
}