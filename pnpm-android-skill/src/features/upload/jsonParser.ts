import type { Deck, Card, QuizItem } from '@/lib/zodSchemas'

function cleanTitle(raw: string): string {
  if (!raw) return ''
  let t = raw.trim()
  t = t.replace(/---+[\s\S]*?(?:REFERENCE MATERIAL|STUDY NOTES)[\s\S]*?---+/gi, '')
  t = t.replace(/TOPIC:\s*/gi, '')
  t = t.replace(/REFERENCE STUDY NOTES:\s*/gi, '')
  t = t.replace(/^(?:Sure(?:!|,|\.)?\s*)?(?:Here (?:are|is)\s+(?:\d+\s+)?(?:interesting\s+|key\s+|important\s+)?(?:facts?|notes?|details?|points?)\s+about\s+)/i, '')
  t = t.replace(/^(?:Certainly(?:!|,|\.)?\s*)/i, '')
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
  t = t.replace(/^[\s#•\-\*:]+/, '').replace(/[\s:]+$/, '').trim()
  if (t.length > 0) {
    t = t.charAt(0).toUpperCase() + t.slice(1)
  }
  return t
}

export function tryRepairAndParseJson(input: string): any {
  let clean = input.trim().replace(/^\uFEFF/, '')
  if (!clean) throw new Error('Empty JSON content')

  // Reject raw HTML responses early
  if (clean.toLowerCase().includes('<!doctype') || clean.toLowerCase().includes('<html')) {
    throw new Error('Server returned an HTML error response instead of JSON deck content')
  }

  // 1. Strip markdown code fences if present
  if (clean.includes('```')) {
    const m = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (m && m[1]) clean = m[1].trim()
    else clean = clean.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim()
  }

  // 2. Extract JSON block if preamble exists
  if (!clean.startsWith('{') && !clean.startsWith('[')) {
    const m = clean.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    if (m) clean = m[0].trim()
  }

  try {
    return JSON.parse(clean)
  } catch {}

  // 3. Remove trailing commas before closing braces/brackets
  let repaired = clean.replace(/,\s*([}\]])/g, '$1')

  try {
    return JSON.parse(repaired)
  } catch {}

  // 4. Sanitize unescaped control characters in strings and balance unclosed braces/quotes
  let out = ''
  const openStack: string[] = []
  let inString = false
  let escaped = false

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i]
    if (char === '\\' && inString) {
      escaped = !escaped
      out += char
      continue
    }
    if (char === '"' && !escaped) {
      inString = !inString
      out += char
    } else if (inString) {
      if (char === '\n') out += '\\n'
      else if (char === '\r') out += '\\r'
      else if (char === '\t') out += '\\t'
      else out += char
    } else {
      if (char === '{' || char === '[') {
        openStack.push(char)
      } else if (char === '}') {
        if (openStack.length > 0 && openStack[openStack.length - 1] === '{') {
          openStack.pop()
        }
      } else if (char === ']') {
        if (openStack.length > 0 && openStack[openStack.length - 1] === '[') {
          openStack.pop()
        }
      }
      out += char
    }
    escaped = false
  }

  if (inString) {
    out += '"'
  }

  // Clean trailing dangling colons or commas
  out = out.replace(/:\s*$/, ': ""').replace(/,\s*$/, '')

  while (openStack.length > 0) {
    const last = openStack.pop()
    if (last === '{') out += '}'
    else if (last === '[') out += ']'
  }

  try {
    return JSON.parse(out)
  } catch (err) {
    // If still failing, attempt trimming last broken element
    const lastComma = out.lastIndexOf(',')
    if (lastComma > 0) {
      let trimmed = out.slice(0, lastComma)
      const subStack: string[] = []
      for (const c of trimmed) {
        if (c === '{' || c === '[') subStack.push(c)
        else if (c === '}' && subStack[subStack.length - 1] === '{') subStack.pop()
        else if (c === ']' && subStack[subStack.length - 1] === '[') subStack.pop()
      }
      while (subStack.length > 0) {
        const top = subStack.pop()
        trimmed += top === '{' ? '}' : ']'
      }
      try {
        return JSON.parse(trimmed)
      } catch {}
    }
    throw new Error('Unable to parse JSON document. The file input ended unexpectedly or is malformed.')
  }
}

export function parseJSONDeckContent(
  rawContent: string | Record<string, any> | any[],
  fallbackTitle?: string,
  fallbackSubject?: string,
  customDeckId?: string
): { deck: Deck; cards: Card[] } {
  let jsonDeck: any
  if (typeof rawContent === 'string') {
    let clean = rawContent.trim()
    // Strip markdown code fences (```json or ```)
    if (clean.includes('```')) {
      const fenceMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
      if (fenceMatch && fenceMatch[1]) {
        clean = fenceMatch[1].trim()
      } else {
        clean = clean.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim()
      }
    }
    // If there is preamble before { or [, extract the JSON block
    if (!clean.startsWith('{') && !clean.startsWith('[')) {
      const match = clean.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
      if (match) clean = match[0].trim()
    }
    jsonDeck = tryRepairAndParseJson(clean)
  } else {
    jsonDeck = rawContent
  }

  // Support root array of cards or object with .cards, .flashcards, .items, or .deck
  const rawCards: any[] = Array.isArray(jsonDeck)
    ? jsonDeck
    : Array.isArray(jsonDeck.cards)
      ? jsonDeck.cards
      : Array.isArray(jsonDeck.flashcards)
        ? jsonDeck.flashcards
        : Array.isArray(jsonDeck.items)
          ? jsonDeck.items
          : Array.isArray(jsonDeck.deck?.cards)
            ? jsonDeck.deck.cards
            : []

  const rawDeckMeta = jsonDeck.deck && typeof jsonDeck.deck === 'object' ? jsonDeck.deck : jsonDeck

  const resolvedTitle =
    cleanTitle(rawDeckMeta?.title || jsonDeck?.title || '') ||
    cleanTitle(fallbackTitle || '') ||
    cleanTitle(rawCards[0]?.front || rawCards[0]?.topic || '') ||
    'Study Deck'

  const primarySubject =
    String(rawDeckMeta?.subject || jsonDeck?.subject || fallbackSubject || 'General').trim() || 'General'

  const deckId = customDeckId || `deck-json-${Date.now()}`
  const uploadedAt = new Date().toISOString()

  const quizItems: QuizItem[] = []

  // Check if explicit quiz items were provided
  if (Array.isArray(jsonDeck.quizItems) && jsonDeck.quizItems.length > 0) {
    for (const q of jsonDeck.quizItems) {
      if (!q || typeof q !== 'object') continue
      const mode = String(q.mode || '').toLowerCase().trim()
      const chapter = String(q.chapter || 'General').trim()
      const subject = String(q.subject || primarySubject).trim()

      if (mode === 'multiple_choice' && q.question && q.correct && Array.isArray(q.distractors) && q.distractors.length >= 3) {
        quizItems.push({
          mode: 'multiple_choice',
          question: String(q.question).trim(),
          correct: String(q.correct).trim(),
          distractors: [String(q.distractors[0]).trim(), String(q.distractors[1]).trim(), String(q.distractors[2]).trim()],
          chapter,
          subject,
        })
      } else if (mode === 'true_false' && q.statement && typeof q.correct === 'boolean') {
        quizItems.push({
          mode: 'true_false',
          statement: String(q.statement).trim(),
          falseVersion: String(q.falseVersion || q.statement).trim(),
          explanation: String(q.explanation || (q.correct ? 'This statement is true.' : 'This statement is false.')).trim(),
          correct: q.correct,
          chapter,
          subject,
        })
      } else if (mode === 'enumeration' && q.topic && Array.isArray(q.items) && q.items.length >= 2) {
        quizItems.push({
          mode: 'enumeration',
          topic: String(q.topic).trim(),
          items: q.items.map((it: any) => String(it).trim().toLowerCase()).filter(Boolean),
          chapter,
          subject,
        })
      } else if (mode === 'identification' && q.definition && q.answer) {
        const variants = Array.isArray(q.acceptVariants) && q.acceptVariants.length > 0
          ? q.acceptVariants.map((v: any) => String(v).trim().toLowerCase()).filter(Boolean)
          : [String(q.answer).trim().toLowerCase()]
        quizItems.push({
          mode: 'identification',
          definition: String(q.definition).trim(),
          answer: String(q.answer).trim(),
          acceptVariants: variants,
          chapter,
          subject,
        })
      }
    }
  }

  const cards: Card[] = []

  rawCards.forEach((c: any, i: number) => {
    if (!c || typeof c !== 'object') return

    const cardId = c.id && String(c.id).startsWith('card-') ? String(c.id) : `card-json-${Date.now()}-${i}`
    const rawType = String(c.type || 'definition').toLowerCase().trim()
    const front = String(c.front || c.question || c.topic || c.statement || c.definition || '').trim()
    if (!front) return

    let back = String(c.back || c.answer || c.explanation || '').trim()
    const chapter = String(c.chapter || rawDeckMeta.chapter || 'Chapter 1').trim()
    const lesson = String(c.lesson || rawDeckMeta.lesson || '').trim()
    const subject = String(c.subject || primarySubject).trim()

    // Coding IDE fields
    const codeObj = c.code || {}
    const code_language = String(codeObj.language || c.code_language || '')
    const code_starter = String(codeObj.starter || c.code_starter || '')
    const code_keywords = Array.isArray(codeObj.keywords) ? codeObj.keywords.join(';') : String(c.code_keywords || '')
    const code_solution = String(codeObj.solution || c.code_solution || '')
    const code_output = String(codeObj.output || c.code_output || '')

    // Math Lab fields
    const mathObj = c.math || {}
    const math_problem = String(mathObj.problem || c.math_problem || mathObj.problem_breakdown?.formula_master || '')
    const math_answer = String(mathObj.answer || c.math_answer || mathObj.key_takeaway || '')
    const math_category = String(mathObj.category || c.math_category || '')
    const math_difficulty = String(mathObj.difficulty || c.math_difficulty || '')
    let math_steps = ''
    if (Array.isArray(mathObj.steps)) {
      math_steps = mathObj.steps.map((s: any) => `${s.latex || ''}|${s.explanation || ''}|${s.operation || s.operationType || 'simplify'}|${s.badge || ''}`).join(' ; ')
    } else if (mathObj.solution_steps) {
      math_steps = String(mathObj.solution_steps)
    } else if (c.math_steps) {
      math_steps = String(c.math_steps)
    }

    // Quiz fields
    const mcObj = c.mc || {}
    const mc_correct = String(mcObj.correct || c.mc_correct || '')
    const mcDistractors = mcObj.distractors || [c.mc_distractor1, c.mc_distractor2, c.mc_distractor3].filter(Boolean)
    const mc_distractor1 = String(mcDistractors[0] || c.mc_distractor1 || '')
    const mc_distractor2 = String(mcDistractors[1] || c.mc_distractor2 || '')
    const mc_distractor3 = String(mcDistractors[2] || c.mc_distractor3 || '')

    const tfObj = c.tf || {}
    const tf_answer = tfObj.answer !== undefined ? String(tfObj.answer) : (c.tf_answer !== undefined ? String(c.tf_answer) : '')
    const explanation = String(tfObj.explanation || c.explanation || '')

    let enum_items = ''
    if (Array.isArray(c.enum_items)) {
      enum_items = c.enum_items.join(';')
    } else if (Array.isArray(c.enum?.items)) {
      enum_items = c.enum.items.join(';')
    } else if (c.enum_items) {
      enum_items = String(c.enum_items)
    }

    const id_answer = String(c.id_answer || c.id?.answer || '')
    const id_variants = Array.isArray(c.id?.variants)
      ? c.id.variants.join(';')
      : Array.isArray(c.id_variants)
        ? c.id_variants.join(';')
        : String(c.id_variants || '')

    // Resolve readable back if empty
    if (!back) {
      if (mc_correct) back = mc_correct
      else if (id_answer) back = id_answer
      else if (code_solution) back = code_solution
      else if (math_answer) back = math_answer
      else if (enum_items) back = enum_items.split(';').map((s: string) => s.trim()).filter(Boolean).join(', ')
      else if (tf_answer) back = (tf_answer.toLowerCase() === 'true' || tf_answer.toLowerCase() === 't') ? 'True' : 'False'
      else back = front
    }

    // Resolve normalized card type
    let normType: Card['type'] = 'definition'
    if (rawType === 'code' || rawType === 'code_challenge' || c.code || front.includes('&[CODE:') || back.includes('&[CODE:')) {
      normType = 'code'
    } else if (rawType === 'math' || rawType === 'math_problem' || c.math || front.includes('&*(') || back.includes('&*(')) {
      normType = 'math'
    } else if (rawType === 'keyword' || back.includes('&[TABLE:') || front.includes('&[TABLE:')) {
      normType = 'keyword'
    } else if (rawType === 'list' || rawType === 'process' || rawType === 'concept' || rawType === 'formula') {
      normType = rawType
    } else if (rawType === 'enumeration' || rawType === 'enum') {
      normType = 'list'
    }

    const isTF = rawType === 'true_false' || rawType === 'tf' || tf_answer !== ''

    if (back) {
      cards.push({
        id: cardId,
        deckId,
        front,
        back,
        chapter,
        subject,
        lesson,
        type: normType,
        mastery: typeof c.mastery === 'number' ? Math.max(-2, Math.min(5, c.mastery)) : 0,
        status: (c.status === 'learning' || c.status === 'mastered') ? c.status : 'new',
        know: typeof c.know === 'boolean' ? c.know : null,
        correctCount: typeof c.correctCount === 'number' ? c.correctCount : 0,
        wrongCount: typeof c.wrongCount === 'number' ? c.wrongCount : 0,
        lastReviewed: c.lastReviewed || null,
        nextReview: c.nextReview || null,
        mc_correct,
        mc_distractor1,
        mc_distractor2,
        mc_distractor3,
        tf_answer,
        enum_items,
        id_answer,
        id_variants,
        code_language,
        code_starter,
        code_keywords,
        code_solution,
        code_output,
        math_problem,
        math_answer,
        math_category,
        math_difficulty,
        math_steps,
      })
    }

    // Auto-derive Quiz Items if not explicitly loaded above
    if (quizItems.length === 0 || !jsonDeck.quizItems) {
      if (mc_correct && (mcDistractors.length >= 1 || (mc_distractor1 && mc_distractor2 && mc_distractor3))) {
        const dists = [mc_distractor1, mc_distractor2, mc_distractor3].filter(Boolean)
        while (dists.length < 3) dists.push('None of the above')
        quizItems.push({
          mode: 'multiple_choice',
          question: front,
          correct: mc_correct,
          distractors: [dists[0], dists[1], dists[2]],
          chapter,
          subject,
        })
      }

      if (isTF && tf_answer !== '') {
        const isTrue = tf_answer.toLowerCase() === 'true' || tf_answer.toLowerCase() === 't' || tf_answer.toLowerCase() === 'yes'
        quizItems.push({
          mode: 'true_false',
          statement: front,
          falseVersion: back || front,
          explanation: explanation || (isTrue ? 'This statement is true.' : 'This statement is false.'),
          correct: isTrue,
          chapter,
          subject,
        })
      }

      if (enum_items) {
        const items = enum_items.split(';').map((s) => s.trim().toLowerCase()).filter(Boolean)
        if (items.length >= 2) {
          quizItems.push({
            mode: 'enumeration',
            topic: front,
            items,
            chapter,
            subject,
          })
        }
      }

      if (id_answer || rawType === 'identification' || rawType === 'id' || rawType === 'definition') {
        const ans = id_answer || back
        if (ans) {
          const variants = id_variants
            ? id_variants.split(';').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
            : [ans.toLowerCase().trim()]
          quizItems.push({
            mode: 'identification',
            definition: front,
            answer: ans,
            acceptVariants: variants,
            chapter,
            subject,
          })
        }
      }
    }
  })

  const deck: Deck = {
    id: deckId,
    title: resolvedTitle,
    subject: primarySubject,
    uploadedAt,
    cards: [],
    quizItems,
  }

  return { deck, cards }
}
