import { downloadFileBlob } from './downloadHelper'
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  AlignmentType,
  VerticalAlign,
  SectionType,
  convertInchesToTwip,
} from 'docx'
import { getCardsByDeck } from '@/db/cardRepository'
import { getDeck } from '@/db/deckRepository'
import { useToastStore } from '@/store/toastStore'
import type { Card } from '@/lib/zodSchemas'

// ── Design Tokens ─────────────────────────────────────────────────────────────
// A restrained editorial palette (ink / indigo accent / paper) rather than a
// generic "dashboard" slate+blue combo. Everything routes through these
// tokens so the whole document can be re-themed from one place.
const PAGE = {
  width: 12240,
  height: 15840,
  margin: {
    top: convertInchesToTwip(0.9),
    bottom: convertInchesToTwip(0.9),
    left: convertInchesToTwip(1),
    right: convertInchesToTwip(1),
  },
}

const CONTENT_WIDTH = PAGE.width - PAGE.margin.left - PAGE.margin.right // 9360 DXA

// The chapter-notes section flows in two newspaper-style columns so long
// chapter lists don't run on forever in a single narrow strip of page.
const NOTES_COLUMN_GAP = convertInchesToTwip(0.4)
const NOTES_COLUMN_WIDTH = Math.floor((CONTENT_WIDTH - NOTES_COLUMN_GAP) / 2)

const COL = {
  term: Math.round(CONTENT_WIDTH * 0.3),
  def: Math.round(CONTENT_WIDTH * 0.48),
  chapter: Math.round(CONTENT_WIDTH * 0.14),
  status: Math.round(CONTENT_WIDTH * 0.08),
}

const FONT_BODY = 'Georgia'
const FONT_UI = 'Calibri'
const FONT_MONO = 'Consolas'

const COLOR = {
  ink: '1C1917', // near-black warm text (Stone 900)
  inkSoft: '44403C', // Stone 700 — body copy
  muted: '78716C', // Stone 500 — captions / meta
  faint: 'A8A29E', // Stone 400 — hairlines / ghost text
  paper: 'FFFFFF',
  paperAlt: 'FAF9F7', // warm off-white for zebra striping
  accent: '4338CA', // Indigo 700 — the single accent color, used sparingly
  accentSoft: 'EEF2FF', // Indigo 50 — tint fill for the table header row
  accentBorder: 'C7D2FE', // Indigo 200
  rule: 'E7E5E4', // Stone 200 — section rules
  good: '166534', // Green 800
  goodTint: 'F0FDF4', // Green 50
  warn: '92400E', // Amber 800
  warnTint: 'FFFBEB', // Amber 50
  code: '9F1239', // Rose 800 for inline code
}

const RULE_NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }

// The reference table now uses the same visual language as the study-note
// callout cards: no grid lines at all, just a colored left accent bar on
// the first column and alternating background tint to separate rows.
const CARD_ACCENT_BAR = { style: BorderStyle.SINGLE, size: 18, color: COLOR.accent }
const borders = { top: RULE_NONE, bottom: RULE_NONE, left: RULE_NONE, right: RULE_NONE }
const firstColBorders = { top: RULE_NONE, bottom: RULE_NONE, left: CARD_ACCENT_BAR, right: RULE_NONE }
const cellMargins = { top: 140, bottom: 140, left: 160, right: 160 }

// ── Markdown Parser for Word ──────────────────────────────────────────────────
function parseMarkdownToRuns(
  text: string,
  base: { size?: number; font?: string; color?: string; bold?: boolean; italics?: boolean } = {}
): TextRun[] {
  if (!text) return [new TextRun({ text: '—', ...base, color: base.color ?? COLOR.faint })]

  const runs: TextRun[] = []
  // Matches ***bold-italic***, **bold**, *italic*, __bold__, _italic_, `code`
  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|___[^_]+___|__[^_]+__|_[^_]+_|`[^`]+`)/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index)
      if (plain) runs.push(new TextRun({ text: plain, ...base }))
    }

    const token = match[0]
    if (token.startsWith('***') && token.endsWith('***')) {
      runs.push(new TextRun({ text: token.slice(3, -3), ...base, bold: true, italics: true }))
    } else if (token.startsWith('**') && token.endsWith('**')) {
      runs.push(new TextRun({ text: token.slice(2, -2), ...base, bold: true }))
    } else if (token.startsWith('__') && token.endsWith('__')) {
      runs.push(new TextRun({ text: token.slice(2, -2), ...base, bold: true }))
    } else if (token.startsWith('*') && token.endsWith('*')) {
      runs.push(new TextRun({ text: token.slice(1, -1), ...base, italics: true }))
    } else if (token.startsWith('_') && token.endsWith('_')) {
      runs.push(new TextRun({ text: token.slice(1, -1), ...base, italics: true }))
    } else if (token.startsWith('`') && token.endsWith('`')) {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          ...base,
          font: FONT_MONO,
          color: COLOR.code,
          size: (base.size ?? 20) - 1,
        })
      )
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    const trailing = text.slice(lastIndex)
    if (trailing) runs.push(new TextRun({ text: trailing, ...base }))
  }

  return runs.length > 0 ? runs : [new TextRun({ text, ...base })]
}

// ── Sorting Helpers ───────────────────────────────────────────────────────────
function sortByChapterThenFront(a: Card, b: Card): number {
  const c = (a.chapter || 'General').localeCompare(b.chapter || 'General')
  return c !== 0 ? c : a.front.localeCompare(b.front)
}

// ── Small Presentational Helpers ──────────────────────────────────────────────
function kicker(text: string): Paragraph {
  // A small tracked-out label above section titles, borrowed from print design.
  return new Paragraph({
    spacing: { before: 0, after: 40 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 15,
        color: COLOR.accent,
        font: FONT_UI,
        characterSpacing: 24,
      }),
    ],
  })
}

function sectionRule(): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 260 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule, space: 1 },
    },
    children: [],
  })
}

function progressBar(pct: number, widthChars = 24): string {
  const filled = Math.round((pct / 100) * widthChars)
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, widthChars - filled))
}

// ── Table Cell Builders ───────────────────────────────────────────────────────
type Alignment = (typeof AlignmentType)[keyof typeof AlignmentType]

function tableHeaderCell(
  text: string,
  width: number,
  isFirst = false,
  align: Alignment = AlignmentType.LEFT
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: isFirst ? firstColBorders : borders,
    margins: cellMargins,
    shading: { fill: COLOR.accentSoft, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: text.toUpperCase(),
            bold: true,
            color: COLOR.ink,
            size: 15,
            font: FONT_UI,
            characterSpacing: 12,
          }),
        ],
      }),
    ],
  })
}

function tableDataCell(
  text: string,
  width: number,
  shade?: string,
  align: Alignment = AlignmentType.LEFT
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    margins: cellMargins,
    shading: shade ? { fill: shade, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align,
        spacing: { line: 264 },
        children: parseMarkdownToRuns(text, { size: 19, font: FONT_UI, color: COLOR.inkSoft }),
      }),
    ],
  })
}

function statusPill(known: boolean): TableCell {
  const bg = known ? COLOR.goodTint : COLOR.warnTint
  const fg = known ? COLOR.good : COLOR.warn
  const label = known ? 'MASTERED' : 'REVIEW'

  return new TableCell({
    width: { size: COL.status, type: WidthType.DXA },
    borders,
    margins: cellMargins,
    shading: { fill: bg, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: label,
            bold: true,
            size: 14,
            color: fg,
            font: FONT_UI,
            characterSpacing: 8,
          }),
        ],
      }),
    ],
  })
}

function buildCardsTable(cards: Card[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      tableHeaderCell('Term / Question', COL.term, true),
      tableHeaderCell('Answer / Explanation', COL.def),
      tableHeaderCell('Chapter', COL.chapter),
      tableHeaderCell('Status', COL.status, false, AlignmentType.CENTER),
    ],
  })

  const rows = cards.map((c, i) => {
    const shade = i % 2 === 1 ? COLOR.paperAlt : undefined

    return new TableRow({
      children: [
        new TableCell({
          width: { size: COL.term, type: WidthType.DXA },
          borders: firstColBorders,
          margins: cellMargins,
          shading: { fill: shade ?? COLOR.paper, type: ShadingType.CLEAR },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              spacing: { line: 264 },
              children: parseMarkdownToRuns(c.front, {
                size: 19,
                bold: true,
                font: FONT_UI,
                color: COLOR.ink,
              }),
            }),
          ],
        }),
        tableDataCell(c.back, COL.def, shade),
        tableDataCell(c.chapter || 'General', COL.chapter, shade),
        statusPill(Boolean(c.know)),
      ],
    })
  })

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [COL.term, COL.def, COL.chapter, COL.status],
    rows: [headerRow, ...rows],
  })
}

// ── Cover ──────────────────────────────────────────────────────────────────────
function buildCover(title: string, subject: string, totalCards: number, masteredCards: number): (Paragraph | Table)[] {
  const pct = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const elements: (Paragraph | Table)[] = []

  elements.push(
    new Paragraph({
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: 'STUDY GUIDE',
          bold: true,
          size: 16,
          color: COLOR.accent,
          font: FONT_UI,
          characterSpacing: 32,
        }),
      ],
    })
  )

  elements.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { before: 0, after: 120, line: 300 },
      children: [
        new TextRun({ text: title, bold: true, size: 56, color: COLOR.ink, font: FONT_BODY }),
      ],
    })
  )

  // Italic serif subtitle — reads like a subtitle on a real book cover.
  elements.push(
    new Paragraph({
      spacing: { before: 0, after: 420 },
      children: [
        new TextRun({
          text: subject || 'General Study',
          italics: true,
          size: 26,
          color: COLOR.muted,
          font: FONT_BODY,
        }),
      ],
    })
  )

  // Meta strip rendered as a borderless 4-column "stat bar" component,
  // rather than an inline text run, so it reads as a designed element.
  const statCell = (label: string, value: string, accentColor: string, isLast: boolean) =>
    new TableCell({
      width: { size: Math.round(CONTENT_WIDTH / 4), type: WidthType.DXA },
      borders: {
        top: RULE_NONE,
        bottom: RULE_NONE,
        left: RULE_NONE,
        right: isLast ? RULE_NONE : { style: BorderStyle.SINGLE, size: 2, color: COLOR.rule },
      },
      margins: { top: 160, bottom: 160, left: 0, right: 200 },
      children: [
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: label.toUpperCase(),
              bold: true,
              size: 14,
              color: COLOR.muted,
              font: FONT_UI,
              characterSpacing: 14,
            }),
          ],
        }),
        new Paragraph({
          children: [new TextRun({ text: value, bold: true, size: 30, color: accentColor, font: FONT_BODY })],
        }),
      ],
    })

  elements.push(
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.ink },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.ink },
        left: RULE_NONE,
        right: RULE_NONE,
        insideHorizontal: RULE_NONE,
        insideVertical: RULE_NONE,
      },
      rows: [
        new TableRow({
          children: [
            statCell('Total Items', String(totalCards), COLOR.ink, false),
            statCell('Mastered', String(masteredCards), COLOR.good, false),
            statCell('Progress', `${pct}%`, COLOR.accent, false),
            statCell('Prepared', dateStr, COLOR.ink, true),
          ],
        }),
      ],
    })
  )

  elements.push(
    new Paragraph({
      spacing: { before: 200, after: 500 },
      children: [
        new TextRun({ text: progressBar(pct), font: FONT_MONO, size: 20, color: COLOR.accent }),
        new TextRun({ text: `  ${pct}% mastered`, font: FONT_UI, size: 17, color: COLOR.muted, italics: true }),
      ],
    })
  )

  return elements
}

// ── Chapter Notes ──────────────────────────────────────────────────────────────
function buildChapterNotesHeading(): Paragraph[] {
  return [
    kicker('Part One'),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: 'Study Notes by Chapter', bold: true, size: 32, color: COLOR.ink, font: FONT_BODY })],
    }),
    sectionRule(),
  ]
}

function buildChapterNotesBody(cards: Card[], contentWidth: number): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = []

  // Group cards by chapter, preserving first-seen order (input is pre-sorted).
  const chaptersMap = new Map<string, Card[]>()
  for (const card of cards) {
    const ch = card.chapter?.trim() || 'General Notes'
    if (!chaptersMap.has(ch)) chaptersMap.set(ch, [])
    chaptersMap.get(ch)!.push(card)
  }

  let chapterIndex = 0
  for (const [chapter, chapterCards] of chaptersMap.entries()) {
    chapterIndex += 1

    // Chapter heading, numbered like a print TOC entry, sitting above a
    // soft accent-tinted rule. Text wraps freely within the column — never
    // truncated — so long chapter titles simply take an extra line.
    elements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: chapterIndex === 1 ? 0 : 360, after: 40 },
        keepNext: true,
        children: [
          new TextRun({
            text: `${String(chapterIndex).padStart(2, '0')}  `,
            bold: true,
            size: 22,
            color: COLOR.accentBorder,
            font: FONT_BODY,
          }),
          new TextRun({ text: chapter, bold: true, size: 22, color: COLOR.ink, font: FONT_BODY }),
        ],
      })
    )
    elements.push(
      new Paragraph({
        spacing: { after: 180 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.accentBorder, space: 1 } },
        children: [],
      })
    )

    // Each concept becomes a callout card — a single-cell shaded table with a
    // colored left rule (docx has no native <div>, so a bordered table cell
    // is the standard way to fake a callout box in a .docx file). Width is
    // sized to the column, not the full page, so it never overflows.
    for (const card of chapterCards) {
      const lines = card.back
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)

      const bodyParagraphs: Paragraph[] = lines.map((line, idx) =>
        new Paragraph({
          spacing: { before: idx === 0 ? 0 : 80, after: 0, line: 264 },
          children: parseMarkdownToRuns(line, { size: 19, color: COLOR.inkSoft, font: FONT_UI }),
        })
      )

      if (bodyParagraphs.length === 0) {
        bodyParagraphs.push(
          new Paragraph({
            children: [new TextRun({ text: '—', size: 19, color: COLOR.faint, font: FONT_UI, italics: true })],
          })
        )
      }

      const calloutTable = new Table({
        width: { size: contentWidth, type: WidthType.DXA },
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: contentWidth, type: WidthType.DXA },
                shading: { fill: COLOR.paperAlt, type: ShadingType.CLEAR },
                margins: { top: 160, bottom: 160, left: 220, right: 180 },
                borders: {
                  top: RULE_NONE,
                  bottom: RULE_NONE,
                  right: RULE_NONE,
                  left: CARD_ACCENT_BAR,
                },
                children: [
                  new Paragraph({
                    spacing: { after: 80 },
                    children: parseMarkdownToRuns(card.front, { bold: true, size: 20, color: COLOR.ink, font: FONT_UI }),
                  }),
                  ...bodyParagraphs,
                ],
              }),
            ],
          }),
        ],
      })

      elements.push(calloutTable)
      elements.push(new Paragraph({ spacing: { after: 180 }, children: [] })) // gap between cards
    }
  }

  return elements
}

// ── Reference Table Section ─────────────────────────────────────────────────────
function buildReferenceSection(cards: Card[]): (Paragraph | Table)[] {
  return [
    kicker('Part Two'),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: 'Flashcard Quick Reference', bold: true, size: 32, color: COLOR.ink, font: FONT_BODY })],
    }),
    new Paragraph({
      spacing: { after: 260 },
      children: [
        new TextRun({
          text: 'Every card in this deck, sorted by chapter, for fast scanning or last-minute review.',
          italics: true,
          size: 19,
          color: COLOR.muted,
          font: FONT_BODY,
        }),
      ],
    }),
    buildCardsTable(cards),
  ]
}

// ── Main Export Function ──────────────────────────────────────────────────────
export async function exportDeckToDOCX(deckId: string, deckTitle: string): Promise<void> {
  const [cards, deck] = await Promise.all([getCardsByDeck(deckId), getDeck(deckId)])

  const subject = deck?.subject || 'Study Guide'
  const knownCount = cards.filter(c => c.know === true).length
  const sortedCards = [...cards].sort(sortByChapterThenFront)

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT_UI, size: 20, color: COLOR.inkSoft },
          paragraph: { spacing: { line: 268 } },
        },
      },
    },
    sections: [
      {
        // Cover + the "Study Notes by Chapter" title, full page width.
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: PAGE.margin,
          },
        },
        children: [...buildCover(deckTitle, subject, cards.length, knownCount), ...buildChapterNotesHeading()],
      },
      {
        // Continues on the same page (no page break) but flows in two
        // columns so long chapter lists don't run into one endless strip.
        properties: {
          type: SectionType.CONTINUOUS,
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: PAGE.margin,
          },
          column: { count: 2, space: NOTES_COLUMN_GAP },
        },
        children: buildChapterNotesBody(sortedCards, NOTES_COLUMN_WIDTH),
      },
      {
        // Back to a single full-width column, starting on a fresh page.
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: PAGE.margin,
          },
        },
        children: buildReferenceSection(sortedCards),
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const filename = `${deckTitle.replace(/\s+/g, '_')}_Study_Guide.docx`

  await downloadFileBlob(blob, filename)
  useToastStore.getState().addToast('Study guide exported successfully!', 'success')
}
