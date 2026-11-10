'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Sparkles, Plus, X, PenLine, Check, Trash2, Search, ListFilter, CheckSquare, Square, AlertTriangle, Upload, FileText, XCircle } from 'lucide-react'
import { parseCSVFile } from '@/features/upload/csvParser'
import { auditAndFixCSV, isCSVInput } from '@/features/upload/csvFixer'
import { handleUpload, handleMultipleUpload, UploadError } from '@/features/upload/uploadHandler'
import { createCards, deleteCard, bulkDeleteCards, getCardsByDeck } from '@/db/cardRepository'
import { updateDeck, deleteDeck } from '@/db/deckRepository'
import { useToastStore } from '@/store/toastStore'
import MathFormattedText from '@/components/MathFormattedText'
import type { Card, Deck } from '@/lib/zodSchemas'

interface FlashcardCreatorProps {
  deckId: string
  deck: Deck | null
  onClose: () => void
  onCardsAdded: () => void
}

type CreatorMode = 'manual' | 'ai' | 'manage' | 'upload'

interface PreviewCard {
  front: string
  back: string
  type: string
}

const CSV_HEADERS = [
  'front', 'back', 'chapter', 'subject', 'lesson', 'type',
  'mc_correct', 'mc_distractor1', 'mc_distractor2', 'mc_distractor3',
  'tf_answer', 'explanation', 'enum_items', 'id_answer', 'id_variants',
  'code_language', 'code_starter', 'code_keywords', 'code_solution', 'code_output',
  'math_problem', 'math_answer', 'math_category', 'math_difficulty', 'math_steps',
]

export default function FlashcardCreator({ deckId, deck, onClose, onCardsAdded }: FlashcardCreatorProps) {
  const addToast = useToastStore((s) => s.addToast)
  const [mode, setMode] = useState<CreatorMode>('manual')

  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [cardType, setCardType] = useState('definition')
  const [mcQuestion, setMcQuestion] = useState('')
  const [mcCorrect, setMcCorrect] = useState('')
  const [mcDistractors, setMcDistractors] = useState(['', '', ''])
  const [tfStatement, setTfStatement] = useState('')
  const [tfCorrect, setTfCorrect] = useState(true)
  const [enumTopic, setEnumTopic] = useState('')
  const [enumItems, setEnumItems] = useState(['', '', ''])
  const [idDescription, setIdDescription] = useState('')
  const [idAnswer, setIdAnswer] = useState('')
  const [idVariants, setIdVariants] = useState([''])

  // Coding IDE fields state
  const [codeLanguage, setCodeLanguage] = useState('javascript')
  const [codeStarter, setCodeStarter] = useState('')
  const [codeKeywords, setCodeKeywords] = useState('')
  const [codeSolution, setCodeSolution] = useState('')
  const [codeOutput, setCodeOutput] = useState('')

  // Math Lab fields state
  const [mathProblem, setMathProblem] = useState('')
  const [mathAnswer, setMathAnswer] = useState('')
  const [mathCategory, setMathCategory] = useState('')
  const [mathDifficulty, setMathDifficulty] = useState('Beginner')
  const [mathSteps, setMathSteps] = useState('')

  const resetManualForm = () => {
    setFront(''); setBack(''); setMcQuestion(''); setMcCorrect(''); setMcDistractors(['', '', ''])
    setTfStatement(''); setTfCorrect(true); setEnumTopic(''); setEnumItems(['', '', ''])
    setIdDescription(''); setIdAnswer(''); setIdVariants([''])
    setCodeLanguage('javascript'); setCodeStarter(''); setCodeKeywords(''); setCodeSolution(''); setCodeOutput('')
    setMathProblem(''); setMathAnswer(''); setMathCategory(''); setMathDifficulty('Beginner'); setMathSteps('')
  }

  useEffect(() => {
    resetManualForm()
  }, [cardType])

  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [previewCards, setPreviewCards] = useState<PreviewCard[]>([])
  const [previewResult, setPreviewResult] = useState<{ cards: any[]; quizItems: any[] } | null>(null)
  const [addingCards, setAddingCards] = useState(false)

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadState, setUploadState] = useState<'idle' | 'processing' | 'error'>('idle')
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadError, setUploadError] = useState('')

  const [existingCards, setExistingCards] = useState<Card[]>([])
  const [existingLoading, setExistingLoading] = useState(false)
  const [existingSearch, setExistingSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean
    cardIds: string[]
    description: string
  } | null>(null)

  const loadExistingCards = async () => {
    setExistingLoading(true)
    try {
      const all = await getCardsByDeck(deckId)
      setExistingCards(all)
      setSelectedIds(new Set())
    } finally {
      setExistingLoading(false)
    }
  }

  useEffect(() => {
    if (mode === 'manage') {
      loadExistingCards()
    }
  }, [mode, deckId])

  const toggleSelectCard = (cardId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

  const toggleSelectAll = (filteredCards: Card[]) => {
    const allFilteredIds = filteredCards.map((c) => c.id)
    const allSelected = allFilteredIds.every((id) => selectedIds.has(id))

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        allFilteredIds.forEach((id) => next.delete(id))
      } else {
        allFilteredIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const promptDeleteCard = (card: Card) => {
    setConfirmDeleteModal({
      isOpen: true,
      cardIds: [card.id],
      description: `"${card.front.length > 50 ? card.front.slice(0, 50) + '...' : card.front}"`,
    })
  }

  const promptBulkDelete = () => {
    if (selectedIds.size === 0) return
    setConfirmDeleteModal({
      isOpen: true,
      cardIds: Array.from(selectedIds),
      description: `${selectedIds.size} selected card${selectedIds.size !== 1 ? 's' : ''}`,
    })
  }

  const executeDelete = async () => {
    if (!confirmDeleteModal || confirmDeleteModal.cardIds.length === 0) return
    const idsToDelete = confirmDeleteModal.cardIds

    // Capture fronts before removing from state (for the log)
    const frontsToLog = idsToDelete.map(
      (id) => existingCards.find((c) => c.id === id)?.front ?? ''
    )

    try {
      if (idsToDelete.length === 1) {
        await deleteCard(idsToDelete[0])
      } else {
        await bulkDeleteCards(idsToDelete)
      }
      setExistingCards((prev) => prev.filter((c) => !idsToDelete.includes(c.id)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        idsToDelete.forEach((id) => next.delete(id))
        return next
      })
      addToast(
        idsToDelete.length === 1 ? 'Card deleted' : `${idsToDelete.length} cards deleted`,
        'success'
      )
      setConfirmDeleteModal(null)

      // Fire-and-forget backend log — non-fatal
      fetch('/api/delete-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardIds: idsToDelete,
          deckId,
          cardFronts: frontsToLog,
        }),
      }).catch(() => {/* swallow — log failure never blocks UX */})

    } catch (err) {
      addToast('Failed to delete card(s)', 'error')
    }
  }

  const resetAi = () => {
    setAiText('')
    setPreviewCards([])
    setPreviewResult(null)
  }

  const handleManualSave = async () => {
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }

    let csvText: string

    switch (cardType) {
      case 'multiple_choice': {
        if (!mcQuestion.trim() || !mcCorrect.trim()) {
          addToast('Question and correct answer are required', 'error'); return
        }
        if (mcDistractors.some(d => !d.trim())) {
          addToast('All 3 distractors are required', 'error'); return
        }
        const headers = ['front', 'back', 'type', 'mc_correct', 'mc_distractor1', 'mc_distractor2', 'mc_distractor3']
        const row = [esc(mcQuestion), esc(mcCorrect), 'multiple_choice', esc(mcCorrect), ...mcDistractors.map(esc)].join(',')
        csvText = [headers.join(','), row].join('\n')
        break
      }
      case 'true_false': {
        if (!tfStatement.trim()) {
          addToast('Statement is required', 'error'); return
        }
        const tfAnswer = tfCorrect ? 'true' : 'false'
        const headers = ['front', 'back', 'type', 'tf_answer']
        const row = [esc(tfStatement), tfCorrect ? 'True' : 'False', 'true_false', tfAnswer].join(',')
        csvText = [headers.join(','), row].join('\n')
        break
      }
      case 'enumeration': {
        if (!enumTopic.trim()) {
          addToast('Topic is required', 'error'); return
        }
        const validItems = enumItems.filter(i => i.trim())
        if (validItems.length < 2) {
          addToast('At least 2 items are required', 'error'); return
        }
        const itemsStr = validItems.join(';')
        const headers = ['front', 'back', 'type', 'enum_items']
        const row = [esc(enumTopic), esc(validItems.join(', ')), 'enumeration', esc(itemsStr)].join(',')
        csvText = [headers.join(','), row].join('\n')
        break
      }
      case 'identification': {
        if (!idDescription.trim() || !idAnswer.trim()) {
          addToast('Description and answer are required', 'error'); return
        }
        const validVariants = idVariants.filter(v => v.trim())
        const variantsStr = validVariants.length > 0 ? validVariants.join(';') : idAnswer.trim().toLowerCase()
        const headers = ['front', 'back', 'type', 'id_answer', 'id_variants']
        const row = [esc(idDescription), esc(idAnswer), 'identification', esc(idAnswer), esc(variantsStr)].join(',')
        csvText = [headers.join(','), row].join('\n')
        break
      }
      case 'code':
      case 'code_challenge': {
        if (!front.trim() || !codeSolution.trim()) {
          addToast('Problem prompt and solution are required', 'error'); return
        }
        const headers = ['front', 'back', 'type', 'code_language', 'code_starter', 'code_keywords', 'code_solution', 'code_output']
        const row = [esc(front), esc(codeSolution), 'code_challenge', esc(codeLanguage), esc(codeStarter), esc(codeKeywords), esc(codeSolution), esc(codeOutput)].join(',')
        csvText = [headers.join(','), row].join('\n')
        break
      }
      case 'math':
      case 'math_problem': {
        if (!mathProblem.trim() || !mathAnswer.trim()) {
          addToast('Math problem and answer are required', 'error'); return
        }
        const headers = ['front', 'back', 'type', 'math_problem', 'math_answer', 'math_category', 'math_difficulty', 'math_steps']
        const row = [esc(mathProblem), esc(mathAnswer), 'math_problem', esc(mathProblem), esc(mathAnswer), esc(mathCategory), esc(mathDifficulty), esc(mathSteps)].join(',')
        csvText = [headers.join(','), row].join('\n')
        break
      }
      case 'keyword': {
        if (!front.trim() || !back.trim()) {
          addToast('Both keyword and notes content are required', 'error'); return
        }
        const headers = ['front', 'back', 'chapter', 'subject', 'lesson', 'type']
        const row = [esc(front), esc(back), '', '', '', 'keyword'].join(',')
        csvText = [headers.join(','), row].join('\n')
        break
      }
      default: {
        if (!front.trim() || !back.trim()) {
          addToast('Both front and back are required', 'error'); return
        }
        const headers = ['front', 'back', 'chapter', 'subject', 'lesson', 'type']
        const row = [esc(front), esc(back), '', '', '', 'definition'].join(',')
        csvText = [headers.join(','), row].join('\n')
      }
    }

    setManualLoading(true)
    try {
      const parsed = parseCSVFile(auditAndFixCSV(csvText), 'temp')
      const cardsWithDeckId = parsed.cards.map((c) => ({ ...c, deckId }))
      await createCards(cardsWithDeckId)

      if (parsed.deck.quizItems.length > 0 && deck) {
        const merged = [...(deck.quizItems || []), ...parsed.deck.quizItems]
        await updateDeck(deckId, { quizItems: merged })
      }

      addToast('Card added!', 'success')
      resetManualForm()
      onCardsAdded()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to add card', 'error')
    } finally {
      setManualLoading(false)
    }
  }

  const handleAiGenerate = async () => {
    if (!aiText.trim()) {
      addToast('Please enter some text', 'error')
      return
    }

    const firstLine = aiText.trim().split('\n')[0]
    const isCSV = isCSVInput(aiText)

    setAiLoading(true)
    try {
      let csvText: string

      if (isCSV) {
        csvText = auditAndFixCSV(aiText.trim())
      } else {
        const formData = new FormData()
        const file = new File([aiText], 'notes.txt', { type: 'text/plain' })
        formData.append('file', file)

        if (deck && deck.cards.length > 0) {
          formData.append('csvHeaders', JSON.stringify(CSV_HEADERS))
        }

        const res = await fetch('/api/convert-docx', { method: 'POST', body: formData })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Generation failed' }))
          throw new Error(errData.error || 'Unable to generate flashcards from this text. Please check the content and try again.')
        }
        csvText = auditAndFixCSV(await res.text())
      }

      const parsed = parseCSVFile(csvText, deck?.title ?? 'Notes')

      if (parsed.cards.length === 0 && parsed.deck.quizItems.length === 0) {
        addToast('No flashcards could be generated from this text', 'error')
        return
      }

      setPreviewCards(parsed.cards.map((c) => ({ front: c.front, back: c.back, type: c.type })))
      setPreviewResult({ cards: parsed.cards, quizItems: parsed.deck.quizItems })
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Generation failed', 'error')
    } finally {
      setAiLoading(false)
    }
  }

  const handleDeletePreviewCard = (index: number) => {
    setPreviewCards((prev) => prev.filter((_, i) => i !== index))
    setPreviewResult((prev) => {
      if (!prev) return null
      return {
        cards: prev.cards.filter((_, i) => i !== index),
        quizItems: prev.quizItems,
      }
    })
  }

  const handleAddAll = async () => {
    if (!previewResult || previewResult.cards.length === 0) return
    setAddingCards(true)
    try {
      const cardsWithDeckId = previewResult.cards.map((c: any) => ({ ...c, deckId }))
      await createCards(cardsWithDeckId)

      if (previewResult.quizItems.length > 0 && deck) {
        const merged = [...(deck.quizItems || []), ...previewResult.quizItems]
        await updateDeck(deckId, { quizItems: merged })
      }

      addToast(`${previewResult.cards.length} cards added!`, 'success')
      resetAi()
      onCardsAdded()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to add cards', 'error')
    } finally {
      setAddingCards(false)
    }
  }

  // Upload functions
  const handleFilesAdded = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles)
    setSelectedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`))
      const toAdd = arr.filter((f) => !existingKeys.has(`${f.name}_${f.size}`))
      return [...prev, ...toAdd]
    })
    setUploadError('')
    setUploadState('idle')
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(e.target.files)
      e.target.value = ''
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setUploadState('idle')
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files)
    }
  }

  const processUploadFiles = async () => {
    if (selectedFiles.length === 0) return

    const tooLarge = selectedFiles.find((f) => f.size > 25 * 1024 * 1024)
    if (tooLarge) {
      setUploadState('error')
      setUploadError(`File "${tooLarge.name}" exceeds 25MB limit`)
      return
    }

    setUploadState('processing')
    setUploadProgress('')
    setUploadError('')

    try {
      const id = await handleMultipleUpload(selectedFiles, setUploadProgress, deck?.title || 'temp')
      
      // Get the newly created deck's cards
      const newDeckCards = await getCardsByDeck(id)
      const cardsWithDeckId = newDeckCards.map((c) => ({ ...c, deckId }))
      await createCards(cardsWithDeckId)

      // Get quiz items from new deck and merge
      // Note: We'd need to fetch the full deck to get quizItems, but for now just add cards
      addToast(`${newDeckCards.length} cards added from upload!`, 'success')
      
      // Clean up the temporary deck
      await deleteDeck(id)
      
      setSelectedFiles([])
      setUploadState('idle')
      onCardsAdded()
    } catch (err) {
      const message = err instanceof UploadError ? err.message : 'Upload failed'
      setUploadState('error')
      setUploadError(message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 " onClick={onClose}>
      <div
        className="bg-[#151722] rounded-2xl border border-[var(--color-border)] w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col "
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-[var(--color-border)] sticky top-0 z-10">
          <h2 className="text-base sm:text-lg font-display font-bold text-[var(--color-text-primary)]">Add / Manage Cards</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 p-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto no-scrollbar">
          {(['manual', 'ai', 'upload', 'manage'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); resetAi() }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors shrink-0 ${
                mode === m
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]'
              }`}
            >
              {m === 'manual' ? <PenLine size={15} /> : m === 'ai' ? <Sparkles size={15} /> : m === 'upload' ? <Upload size={15} /> : <ListFilter size={15} />}
              {m === 'manual' ? 'Manual' : m === 'ai' ? 'AI Generate' : m === 'upload' ? 'Upload Files' : `Manage (${existingCards.length || deck?.cards.length || 0})`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {mode === 'manual' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1">
                {(['definition', 'keyword', 'multiple_choice', 'true_false', 'enumeration', 'identification', 'code_challenge', 'math_problem'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setCardType(t)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      cardType === t
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]'
                    }`}
                  >
                    {t === 'definition' ? 'Definition' : t === 'keyword' ? 'Notes / Key' : t === 'multiple_choice' ? 'MC' : t === 'true_false' ? 'T/F' : t === 'enumeration' ? 'Enum' : t === 'identification' ? 'ID' : t === 'code_challenge' ? 'Code' : 'Math'}
                  </button>
                ))}
              </div>

              {cardType === 'keyword' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Topic / Keyword</label>
                    <input type="text" value={front} onChange={(e) => setFront(e.target.value)} placeholder="e.g. CLARO M. RECTO or RIZAL BILL"
                      className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Notes / Bullet Points / Dates</label>
                    <textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder={`e.g.\n• Born: Feb 8, 1890 | Died: Oct 2, 1960\n• Parents: Claro Recto Sr. & Micaela Mayo\n• Authored by Senator Claro M. Recto`}
                      rows={5} className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none font-sans" />
                  </div>
                </div>
              )}

              {cardType === 'definition' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Front</label>
                    <input type="text" value={front} onChange={(e) => setFront(e.target.value)} placeholder="Enter the question or term"
                      className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Back</label>
                    <textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="Enter the answer or definition"
                      rows={3} className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none" />
                  </div>
                </div>
              )}

              {cardType === 'multiple_choice' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Question</label>
                    <input type="text" value={mcQuestion} onChange={(e) => setMcQuestion(e.target.value)} placeholder="Enter the question"
                      className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Correct Answer</label>
                    <input type="text" value={mcCorrect} onChange={(e) => setMcCorrect(e.target.value)} placeholder="The correct answer"
                      className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Distractors</label>
                    <div className="space-y-2">
                      {mcDistractors.map((d, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[var(--color-text-muted)] w-4">{['A','B','C'][i]}</span>
                          <input type="text" value={d} onChange={(e) => {
                            const next = [...mcDistractors]; next[i] = e.target.value; setMcDistractors(next)
                          }} placeholder={`Distractor ${i + 1}`}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]" />
                          <button onClick={() => {
                            const next = [...mcDistractors]; next[i] = ''; setMcDistractors(next)
                          }} className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Clear distractor">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {cardType === 'true_false' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Statement</label>
                    <textarea value={tfStatement} onChange={(e) => setTfStatement(e.target.value)} placeholder="Enter the statement"
                      rows={3} className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Correct Answer</label>
                    <div className="flex gap-2">
                      <button onClick={() => setTfCorrect(true)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-medium transition-colors flex-1 ${
                          tfCorrect ? 'border-[var(--color-know)] bg-[var(--color-know-soft)] text-[var(--color-know)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                        }`}>
                        {tfCorrect && <Check size={16} />} True
                      </button>
                      <button onClick={() => setTfCorrect(false)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-medium transition-colors flex-1 ${
                          !tfCorrect ? 'border-[var(--color-dontknow)] bg-[var(--color-dontknow-soft)] text-[var(--color-dontknow)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                        }`}>
                        {!tfCorrect && <Check size={16} />} False
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {cardType === 'enumeration' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Topic</label>
                    <input type="text" value={enumTopic} onChange={(e) => setEnumTopic(e.target.value)} placeholder="e.g. Types of clouds"
                      className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Items</label>
                    <div className="space-y-2">
                      {enumItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[var(--color-text-muted)] w-4">{i + 1}.</span>
                          <input type="text" value={item} onChange={(e) => {
                            const next = [...enumItems]; next[i] = e.target.value; setEnumItems(next)
                          }} placeholder={`Item ${i + 1}`}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]" />
                          <button onClick={() => setEnumItems(enumItems.filter((_, j) => j !== i))}
                            className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Remove item">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setEnumItems([...enumItems, ''])}
                      className="mt-2 text-sm text-[var(--color-accent)] hover:underline">
                      + Add item
                    </button>
                  </div>
                </div>
              )}

              {cardType === 'identification' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Description</label>
                    <textarea value={idDescription} onChange={(e) => setIdDescription(e.target.value)} placeholder="The description or clue"
                      rows={2} className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Answer</label>
                    <input type="text" value={idAnswer} onChange={(e) => setIdAnswer(e.target.value)} placeholder="The correct term"
                      className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Accept Variants</label>
                    <div className="space-y-2">
                      {idVariants.map((v, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input type="text" value={v} onChange={(e) => {
                            const next = [...idVariants]; next[i] = e.target.value; setIdVariants(next)
                          }} placeholder={`Variant ${i + 1}`}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]" />
                          <button onClick={() => setIdVariants(idVariants.filter((_, j) => j !== i))}
                            className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Remove variant">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setIdVariants([...idVariants, ''])}
                      className="mt-2 text-sm text-[var(--color-accent)] hover:underline">
                      + Add variant
                    </button>
                  </div>
                </div>
              )}

              {(cardType === 'code' || cardType === 'code_challenge') && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Problem Prompt</label>
                    <input type="text" value={front} onChange={(e) => setFront(e.target.value)} placeholder="e.g. Write a function to reverse a string"
                      className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Language</label>
                      <select value={codeLanguage} onChange={(e) => setCodeLanguage(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]">
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                        <option value="java">Java</option>
                        <option value="sql">SQL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Keywords (semicolon separated)</label>
                      <input type="text" value={codeKeywords} onChange={(e) => setCodeKeywords(e.target.value)} placeholder="e.g. split;reverse;join"
                        className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Starter Template (optional)</label>
                    <textarea value={codeStarter} onChange={(e) => setCodeStarter(e.target.value)} placeholder="e.g. function reverseString(str) {\n  // your code here\n}"
                      rows={3} className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none font-mono text-xs" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Solution</label>
                    <textarea value={codeSolution} onChange={(e) => setCodeSolution(e.target.value)} placeholder="Expected solution code"
                      rows={4} className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none font-mono text-xs" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Expected Output (optional)</label>
                    <input type="text" value={codeOutput} onChange={(e) => setCodeOutput(e.target.value)} placeholder="e.g. olleh"
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] font-mono text-xs" />
                  </div>
                </div>
              )}

              {(cardType === 'math' || cardType === 'math_problem') && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Math Problem (LaTeX / Text)</label>
                    <input type="text" value={mathProblem} onChange={(e) => setMathProblem(e.target.value)} placeholder="e.g. 3x + 9 = 24"
                      className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Final Answer</label>
                    <input type="text" value={mathAnswer} onChange={(e) => setMathAnswer(e.target.value)} placeholder="e.g. x = 5"
                      className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Category</label>
                      <input type="text" value={mathCategory} onChange={(e) => setMathCategory(e.target.value)} placeholder="e.g. Algebra"
                        className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Difficulty</label>
                      <select value={mathDifficulty} onChange={(e) => setMathDifficulty(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]">
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Steps (format: latex|explanation|operationType|badge ; ...)</label>
                    <textarea value={mathSteps} onChange={(e) => setMathSteps(e.target.value)} placeholder="e.g. 3x = 15|Subtract 9 from both sides|add_sub|-9 ; x = 5|Divide both sides by 3|mul_div|/3"
                      rows={3} className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none font-mono text-xs" />
                  </div>
                </div>
              )}

              <button
                onClick={handleManualSave}
                disabled={manualLoading || (cardType === 'definition' && (!front.trim() || !back.trim())) || (cardType === 'multiple_choice' && (!mcQuestion.trim() || !mcCorrect.trim() || mcDistractors.some(d => !d.trim()))) || (cardType === 'true_false' && !tfStatement.trim()) || (cardType === 'enumeration' && (!enumTopic.trim() || enumItems.filter(i => i.trim()).length < 2)) || (cardType === 'identification' && (!idDescription.trim() || !idAnswer.trim())) || ((cardType === 'code' || cardType === 'code_challenge') && (!front.trim() || !codeSolution.trim())) || ((cardType === 'math' || cardType === 'math_problem') && (!mathProblem.trim() || !mathAnswer.trim()))}
                className="flex items-center gap-2 bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {manualLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {manualLoading ? 'Saving…' : 'Save Card'}
              </button>
            </div>
          ) : mode === 'manage' ? (
            <div className="space-y-3">
              {/* Search & Bulk Action Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    value={existingSearch}
                    onChange={(e) => setExistingSearch(e.target.value)}
                    placeholder="Search existing cards…"
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-xs sm:text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>

                {existingCards.length > 0 && (
                  <button
                    onClick={() => {
                      const filtered = existingCards.filter((c) =>
                        !existingSearch ||
                        c.front.toLowerCase().includes(existingSearch.toLowerCase()) ||
                        c.back.toLowerCase().includes(existingSearch.toLowerCase()) ||
                        c.type.toLowerCase().includes(existingSearch.toLowerCase())
                      )
                      toggleSelectAll(filtered)
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors shrink-0"
                    title="Select/Deselect all visible cards"
                  >
                    <CheckSquare size={14} />
                    <span className="hidden sm:inline">Select All</span>
                  </button>
                )}

                {selectedIds.size > 0 && (
                  <button
                    onClick={promptBulkDelete}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[var(--color-dontknow)] text-white hover:opacity-90 transition-opacity shrink-0 shadow-sm"
                  >
                    <Trash2 size={14} />
                    <span>Delete ({selectedIds.size})</span>
                  </button>
                )}
              </div>

              {existingLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-[var(--color-text-muted)]">
                  <Loader2 size={18} className="animate-spin mr-2" /> Loading cards…
                </div>
              ) : existingCards.length === 0 ? (
                <div className="text-center py-12 text-sm text-[var(--color-text-muted)]">
                  No cards in this deck yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {existingCards
                    .filter((c) =>
                      !existingSearch ||
                      c.front.toLowerCase().includes(existingSearch.toLowerCase()) ||
                      c.back.toLowerCase().includes(existingSearch.toLowerCase()) ||
                      c.type.toLowerCase().includes(existingSearch.toLowerCase())
                    )
                    .map((card, idx) => {
                      const isSelected = selectedIds.has(card.id)

                      return (
                        <div
                          key={card.id}
                          onClick={() => toggleSelectCard(card.id)}
                          className={`relative p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer select-none ${
                            isSelected
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/20'
                              : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-accent)]/40'
                          }`}
                        >
                          {/* Checkbox */}
                          <div className="pt-0.5 shrink-0 text-[var(--color-text-muted)]">
                            {isSelected ? (
                              <CheckSquare size={17} className="text-[var(--color-accent)]" />
                            ) : (
                              <Square size={17} />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">#{idx + 1}</span>
                              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                                {card.type}
                              </span>
                              {card.chapter && (
                                <span className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[120px]">
                                  {card.chapter}
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2">
                              <MathFormattedText text={card.front} />
                            </div>
                            <div className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                              <MathFormattedText text={card.back} />
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              promptDeleteCard(card)
                            }}
                            className="relative z-10 shrink-0 p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-dontknow)] hover:bg-[var(--color-dontknow)]/10 transition-colors"
                            title="Delete card"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          ) : mode === 'upload' ? (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".csv,.docx,.txt,.pdf,.ppt,.pptx"
                className="hidden"
                onChange={handleFileSelect}
              />

              {uploadState === 'processing' ? (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-8 text-center flex flex-col items-center gap-3">
                  <Loader2 size={32} className="animate-spin text-[var(--color-accent)]" />
                  <p className="text-sm font-medium text-[var(--color-text-primary)] animate-pulse">{uploadProgress || 'Processing files…'}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Extracting text & adding cards to deck</p>
                </div>
              ) : uploadState === 'error' ? (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 text-center">
                  <XCircle size={40} className="mx-auto text-[var(--color-dontknow)]" />
                  <p className="text-sm text-[var(--color-dontknow)] mt-3">{uploadError}</p>
                  <button
                    onClick={() => setUploadState('idle')}
                    className="bg-[var(--color-accent)] text-white px-5 py-2.5 rounded-xl font-medium mt-4 hover:opacity-90 transition-opacity"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setUploadState('idle') }}
                    onDragLeave={() => setUploadState('idle')}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200 cursor-pointer border-[var(--color-border-strong)] hover:border-[var(--color-accent)] bg-[var(--color-surface-2)]/50"
                  >
                    <Upload size={36} className="mx-auto text-[var(--color-accent)]" />
                    <p className="text-sm font-medium mt-2 text-[var(--color-text-primary)]">
                      Drop files here or click to browse
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      PDF, PPTX, DOCX, TXT, CSV — Cards will be added to current deck
                    </p>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                          Selected Files ({selectedFiles.length})
                        </span>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1 font-medium"
                        >
                          <Plus size={14} /> Add more files
                        </button>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileText size={18} className="text-[var(--color-accent)] shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-[var(--color-text-primary)] truncate max-w-[280px]">
                                  {file.name}
                                </p>
                                <p className="text-[10px] text-[var(--color-text-muted)]">
                                  {(file.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveFile(idx)}
                              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-dontknow)] hover:bg-[var(--color-surface-3)] transition-colors"
                              title="Remove file"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={processUploadFiles}
                        className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity"
                      >
                        <Sparkles size={18} />
                        Add Cards from Files ({selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'})
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {previewCards.length === 0 ? (
                <>
                  <textarea
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    placeholder="Describe what you want flashcards about, or paste a paragraph of notes"
                    rows={8}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
                  />
                  <button
                    onClick={handleAiGenerate}
                    disabled={aiLoading || !aiText.trim()}
                    className="flex items-center gap-2 bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {aiLoading ? 'Generating…' : 'Generate Cards'}
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Generated {previewCards.length} card{previewCards.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {previewCards.map((card, i) => (
                      <div key={i} className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                              <MathFormattedText text={card.front} />
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">
                              <MathFormattedText text={card.back} />
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${
                              card.type === 'keyword'
                                ? 'bg-[var(--color-mastered)]/20 text-[var(--color-mastered)]'
                                : 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                            }`}>
                              {card.type === 'keyword' ? 'Notes' : card.type}
                            </span>
                            <button
                              onClick={() => handleDeletePreviewCard(i)}
                              className="shrink-0 p-1 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all"
                              title="Remove item"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleAddAll}
                      disabled={addingCards}
                      className="flex items-center gap-2 bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex-1"
                    >
                      {addingCards ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      {addingCards
                        ? 'Adding…'
                        : (() => {
                            const kwCount = previewResult?.cards.filter((c: any) => c.type === 'keyword').length ?? 0
                            const fcCount = (previewResult?.cards.length ?? 0) - kwCount
                            if (kwCount > 0 && fcCount > 0) return `Add ${fcCount} Cards & ${kwCount} Notes`
                            if (kwCount > 0) return `Add ${kwCount} Note${kwCount !== 1 ? 's' : ''} to Deck`
                            return `Add ${fcCount} Card${fcCount !== 1 ? 's' : ''} to Deck`
                          })()}
                    </button>
                    <button
                      onClick={resetAi}
                      disabled={addingCards}
                      className="flex items-center gap-2 bg-[var(--color-surface-2)] text-[var(--color-text-primary)] px-6 py-3 rounded-xl font-medium hover:bg-[var(--color-surface)] disabled:opacity-50 transition-colors"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* In-app HTML Confirmation Modal for Delete */}
      {confirmDeleteModal?.isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70  animate-in fade-in duration-150"
          onClick={() => setConfirmDeleteModal(null)}
        >
          <div
            className="bg-[#151722] rounded-2xl border border-[var(--color-border)] w-full max-w-sm p-6  shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-[var(--color-dontknow)]">
              <div className="p-2.5 rounded-xl bg-[var(--color-dontknow)]/15">
                <AlertTriangle size={22} />
              </div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                Delete {confirmDeleteModal.cardIds.length === 1 ? 'Card' : `${confirmDeleteModal.cardIds.length} Cards`}?
              </h3>
            </div>

            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-[var(--color-text-primary)]">{confirmDeleteModal.description}</span>? This action cannot be undone.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] text-sm font-medium hover:bg-[var(--color-surface)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-dontknow)] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
