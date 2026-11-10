const EXPECTED_COLS = 25

const CSV_HEADER = [
  'front', 'back', 'chapter', 'subject', 'lesson', 'type',
  'mc_correct', 'mc_distractor1', 'mc_distractor2', 'mc_distractor3',
  'tf_answer', 'explanation', 'enum_items', 'id_answer', 'id_variants',
  'code_language', 'code_starter', 'code_keywords', 'code_solution', 'code_output',
  'math_problem', 'math_answer', 'math_category', 'math_difficulty', 'math_steps'
].join(',')

function parseCSVRow(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

function quoteField(val: string): string {
  if (!val) return ''
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes(' ')) {
    return '"' + val.replace(/"/g, '""') + '"'
  }
  return val
}

const KNOWN_TYPES = new Set([
  'definition', 'concept', 'formula', 'process', 'list', 'keyword',
  'multiple_choice', 'mc', 'true_false', 'tf', 'enumeration', 'enum', 'identification', 'id',
  'code', 'code_challenge', 'math', 'math_problem'
])

function fixRow(row: string[]): string[] {
  let r = [...row]

  // If short row where type is in column 2 or 3
  if (r.length === 3 && KNOWN_TYPES.has(r[2]?.toLowerCase().trim())) {
    r = [r[0], r[1], '', '', '', r[2]]
  } else if (r.length === 4 && KNOWN_TYPES.has(r[3]?.toLowerCase().trim())) {
    r = [r[0], r[1], r[2], '', '', r[3]]
  } else if (r.length >= 5 && KNOWN_TYPES.has(r[4]?.toLowerCase().trim())) {
    // 15-col row where lesson was omitted so type shifted to index 4
    r = [r[0], r[1], r[2], r[3], '', ...r.slice(4)]
  }

  const type = (r[5] || '').toLowerCase().trim().replace(/"/g, '')

  // Handle 16-col legacy identification rows
  if (r.length === 16 && type === 'identification') {
    const answer = r[13] || r[14] || ''
    const variants = r[14] || ''
    r = [r[0], r[1], r[2], r[3], r[4], r[5], '', '', '', '', '', '', '', answer, variants, '', '', '', '', '', '', '', '', '', '']
  }

  // If already 25 columns, keep all 25 intact
  if (r.length === EXPECTED_COLS) {
    return r
  }

  // If less than 25 columns, pad with empty strings up to 25 columns
  if (r.length < EXPECTED_COLS) {
    return [...r, ...Array(EXPECTED_COLS - r.length).fill('')]
  }

  // If more than 25 columns, truncate to 25
  return r.slice(0, EXPECTED_COLS)
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

export function auditAndFixCSV(csvText: string): string {
  const lines = splitCSVRows(csvText.trim())

  if (!lines.length) return ''

  let dataStart = 0
  const firstLine = lines[0].trim()
  if (firstLine.startsWith('front') || firstLine.includes('quiz_type')) {
    dataStart = 1
  }

  const fixedRows: string[][] = []

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const row = parseCSVRow(line)
    fixedRows.push(fixRow(row))
  }

  return [CSV_HEADER, ...fixedRows.map(r => r.map(quoteField).join(','))].join('\n')
}

export function isCSVInput(text: string): boolean {
  const firstLine = text.trim().split(/\r?\n/)[0]?.trim() ?? ''
  return /^front[,\t]/.test(firstLine)
}
