'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import StudyHeader, { HeaderIconButton } from '@/components/StudyHeader'
import PastePopup from '@/features/blanks/PastePopup'
import FillInTheBlanksUI from '@/features/blanks/FillInTheBlanksUI'
import { parseBlanks, TextToken } from '@/features/blanks/parseBlanks'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { getDeckBlanks, createDeckBlank, deleteDeckBlank, DeckBlank } from '@/features/blanks/deckBlanksApi'
import { getDeck } from '@/db/deckRepository'
import type { Deck } from '@/lib/zodSchemas'

function BlanksContent({ deckId }: { deckId?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialBlankId = searchParams.get('blankId')
  const effectiveDeckId = (deckId && deckId !== '_offline')
    ? deckId
    : (typeof window !== 'undefined' ? window.location.pathname.split('/study/')[1]?.split('/')[0]?.split('?')[0] || '' : '')

  const [deck, setDeck] = useState<Deck | null>(null)
  const [savedBlanks, setSavedBlanks] = useState<DeckBlank[]>([])
  const [activeBlank, setActiveBlank] = useState<DeckBlank | null>(null)
  const [tokens, setTokens] = useState<TextToken[]>([])
  const [isPastePopupOpen, setPastePopupOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!effectiveDeckId) return
      const d = await getDeck(effectiveDeckId)
      if (d) setDeck(d)
      
      const blanks = await getDeckBlanks(effectiveDeckId)
      setSavedBlanks(blanks)
      
      if (initialBlankId) {
        const target = blanks.find(b => b.id === initialBlankId)
        if (target) {
          setActiveBlank(target)
          setTokens(parseBlanks(target.text_content))
        }
      } else if (blanks.length > 0) {
        setActiveBlank(blanks[0])
        setTokens(parseBlanks(blanks[0].text_content))
      }
      
      setIsLoading(false)
    }
    loadData()
  }, [effectiveDeckId, initialBlankId])

  const handleGenerateAndSave = async (title: string, text: string) => {
    const newBlank = await createDeckBlank(effectiveDeckId, title, text)
    if (newBlank) {
      setSavedBlanks(prev => [newBlank, ...prev])
      handleSelectBlank(newBlank)
      window.dispatchEvent(new CustomEvent('blanks-updated'))
    }
  }

  const handleSelectBlank = (blank: DeckBlank) => {
    setActiveBlank(blank)
    setTokens(parseBlanks(blank.text_content))
  }

  const handleDelete = async (id: string) => {
    await deleteDeckBlank(id)
    const updated = savedBlanks.filter(b => b.id !== id)
    setSavedBlanks(updated)
    window.dispatchEvent(new CustomEvent('blanks-updated'))
    
    if (activeBlank?.id === id) {
      if (updated.length > 0) {
        handleSelectBlank(updated[0])
      } else {
        setActiveBlank(null)
        setTokens([])
      }
    }
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-[#0b0c14] text-white">
      <div className="max-w-3xl w-full mx-auto px-4 pt-2">
        <StudyHeader 
          title={deck ? `${deck.title} · Blanks` : 'Fill-in-the-Blanks'} 
          closeIcon="back"
          onClose={() => router.push(`/study/${effectiveDeckId}`)}
          rightSlot={
            <div className="flex items-center gap-1">
              <HeaderIconButton
                onClick={() => setPastePopupOpen(true)}
                title="Create New Blank"
              >
                <Plus size={19} />
              </HeaderIconButton>
              {activeBlank && activeBlank.id !== 'temp' && (
                <HeaderIconButton
                  onClick={() => {
                    if (window.confirm('Delete this saved blank?')) {
                      handleDelete(activeBlank.id)
                    }
                  }}
                  title="Delete Blank"
                >
                  <Trash2 size={18} className="text-[#ff5252]" />
                </HeaderIconButton>
              )}
            </div>
          }
        />
      </div>
      
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {!activeBlank || tokens.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto h-full">
            <div className="w-16 h-16 rounded-[20px] bg-[#1b0e3e] border-2 border-[#2f1e5e] flex items-center justify-center mb-5 shadow-lg">
              <FileText size={28} className="text-[#9d7eff]" />
            </div>
            <h2 className="font-display text-[20px] font-extrabold text-white mb-2">
              Practice Document Blanks
            </h2>
            <p className="text-[#8e92a8] text-[14px] mb-6 leading-relaxed">
              Paste or generate text passages to practice sentence-level active recall.
            </p>
            <button
              type="button"
              onClick={() => setPastePopupOpen(true)}
              className="h-12 px-6 rounded-[14px] bg-[#7e57ff] border-2 border-[#9d7eff] shadow-[0px_3px_0px_0px_#4c2fb3] text-white font-extrabold text-[15px] flex items-center gap-2 tactile-btn cursor-pointer"
            >
              <Plus size={18} />
              <span>Create New Blanks</span>
            </button>
          </div>
        ) : (
          <FillInTheBlanksUI 
            tokens={tokens} 
            onReset={() => {
              setActiveBlank(null)
              setTokens([])
            }} 
          />
        )}

        <PastePopup 
          isOpen={isPastePopupOpen}
          onClose={() => setPastePopupOpen(false)}
          onSubmit={handleGenerateAndSave}
        />
      </div>
    </div>
  )
}

export default function BlanksClient({ deckId }: { deckId?: string }) {
  return (
    <Suspense fallback={
      <div className="h-[100dvh] w-full flex items-center justify-center bg-[#0b0c14]">
        <div className="w-12 h-12 border-4 border-[#7e57ff] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BlanksContent deckId={deckId} />
    </Suspense>
  )
}
