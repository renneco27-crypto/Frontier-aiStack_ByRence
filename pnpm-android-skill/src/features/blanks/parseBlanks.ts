import nlp from 'compromise'

export interface TextToken {
  id: string
  text: string
  isWord: boolean
  isBlank: boolean
}

export type BlankStrategy = 'smart' | 'random'

export function parseBlanks(
  text: string,
  blankPercentage: number = 0.25,
  strategy: BlankStrategy = 'smart'
): TextToken[] {
  // Regex to split by words but keep whitespace and punctuation as separate tokens
  const tokens = text.split(/([a-zA-Z0-9_]+)/g).filter(Boolean)
  
  const wordTokens = tokens.map((text, i) => {
    const isWord = /^[a-zA-Z0-9_]+$/.test(text)
    return { text, isWord, originalIndex: i }
  }).filter(t => t.isWord)
  
  // Use Math.ceil so even short sentences get a fair amount of blanks
  const numBlanks = Math.max(1, Math.ceil(wordTokens.length * blankPercentage))
  const selectedBlankIndices = new Set<number>()

  // Randomize indices to avoid always picking the first few
  const shuffledWordTokens = [...wordTokens].sort(() => 0.5 - Math.random())

  if (strategy === 'smart') {
    // Step 1: Use Compromise NLP to find high-value entities
    const doc = nlp(text)
    const targetPhrases = new Set([
      ...doc.match('#Date').out('array'),
      ...doc.match('#Person').out('array'),
      ...doc.match('#Place').out('array'),
      ...doc.match('#Organization').out('array'),
      ...doc.match('#Acronym').out('array')
    ].flatMap((p: string) => p.toLowerCase().split(/\s+/)))

    // Step 2: Fallback to nouns
    const nounPhrases = new Set(
      doc.match('#Noun').out('array').flatMap((p: string) => p.toLowerCase().split(/\s+/))
    )

    // Select Prime Entities (Dates, People, Places, etc.)
    for (const token of shuffledWordTokens) {
      if (selectedBlankIndices.size < numBlanks && targetPhrases.has(token.text.toLowerCase())) {
        selectedBlankIndices.add(token.originalIndex)
      }
    }

    // Select Nouns if we need more blanks
    for (const token of shuffledWordTokens) {
      if (selectedBlankIndices.size < numBlanks && !selectedBlankIndices.has(token.originalIndex) && nounPhrases.has(token.text.toLowerCase())) {
        selectedBlankIndices.add(token.originalIndex)
      }
    }
  }

  // Purely random words (always used for 'random' strategy, or fallback for 'smart' if more blanks needed)
  for (const token of shuffledWordTokens) {
    if (selectedBlankIndices.size < numBlanks && !selectedBlankIndices.has(token.originalIndex)) {
      selectedBlankIndices.add(token.originalIndex)
    }
  }
  
  // Build final array
  return tokens.map((text, i) => {
    const isWord = /^[a-zA-Z0-9_]+$/.test(text)
    return {
      id: `token-${i}`,
      text,
      isWord,
      isBlank: isWord && selectedBlankIndices.has(i)
    }
  })
}
