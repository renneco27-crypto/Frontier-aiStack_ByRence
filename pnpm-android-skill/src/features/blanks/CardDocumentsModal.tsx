'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Plus, Share2, ArrowLeft } from 'lucide-react'
import { getCardDocuments, uploadCardDocument, type CardDocument } from './cardDocumentsApi'
import FillInTheBlanksUI from './FillInTheBlanksUI'
import { parseBlanks, TextToken } from './parseBlanks'

interface CardDocumentsModalProps {
  cardId: string
  isOpen: boolean
  onClose: () => void
}

export default function CardDocumentsModal({ cardId, isOpen, onClose }: CardDocumentsModalProps) {
  const [activeTab, setActiveTab] = useState<'feed' | 'paste' | 'study'>('feed')
  const [documents, setDocuments] = useState<CardDocument[]>([])
  const [loading, setLoading] = useState(true)
  
  // Paste state
  const [pasteText, setPasteText] = useState('')
  const [shareWithCommunity, setShareWithCommunity] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  
  // Study state
  const [studyTokens, setStudyTokens] = useState<TextToken[]>([])

  useEffect(() => {
    if (isOpen && activeTab === 'feed') {
      loadDocuments()
    }
  }, [isOpen, cardId, activeTab])

  const loadDocuments = async () => {
    setLoading(true)
    const docs = await getCardDocuments(cardId)
    setDocuments(docs)
    setLoading(false)
  }

  const handleStudyDocument = (text: string) => {
    setStudyTokens(parseBlanks(text))
    setActiveTab('study')
  }

  const handleSubmitPaste = async () => {
    if (!pasteText.trim()) return
    
    if (shareWithCommunity) {
      setIsUploading(true)
      await uploadCardDocument(cardId, pasteText.trim())
      setIsUploading(false)
    }
    
    handleStudyDocument(pasteText.trim())
    setPasteText('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60  p-4">
      <div 
        className="w-full max-w-4xl max-h-[90vh] bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()} // prevent clicks inside from closing (if implemented)
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-3">
            {activeTab !== 'feed' && (
              <button 
                onClick={() => setActiveTab('feed')}
                className="p-2 -ml-2 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h2 className="font-display text-xl font-bold text-[var(--color-text-primary)]">
              {activeTab === 'feed' ? 'Community Notes' : activeTab === 'paste' ? 'Add New Note' : 'Study Note'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto relative">
          {activeTab === 'feed' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <p className="text-[var(--color-text-secondary)] text-sm">
                  Practice Fill-in-the-Blanks with notes shared by others for this specific card.
                </p>
                <button
                  onClick={() => setActiveTab('paste')}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shrink-0 shadow-sm"
                >
                  <Plus size={16} />
                  Add Note
                </button>
              </div>

              {loading ? (
                <div className="py-12 flex justify-center text-[var(--color-text-muted)] animate-pulse">
                  Loading notes...
                </div>
              ) : documents.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] flex items-center justify-center mb-4">
                    <FileText size={24} className="text-[var(--color-text-muted)]" />
                  </div>
                  <p className="text-[var(--color-text-secondary)]">No notes have been shared for this card yet.</p>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">Be the first to add one!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documents.map((doc) => (
                    <div 
                      key={doc.id}
                      onClick={() => handleStudyDocument(doc.text_content)}
                      className="group p-5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)] cursor-pointer transition-all hover:shadow-md flex flex-col h-40"
                    >
                      <div className="flex-1 overflow-hidden relative">
                        <p className="text-[var(--color-text-primary)] text-sm leading-relaxed line-clamp-3">
                          {doc.text_content}
                        </p>
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[var(--color-surface-2)] to-transparent" />
                      </div>
                      <div className="pt-3 mt-3 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        <span className="group-hover:text-[var(--color-accent)] font-medium transition-colors">Study →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'paste' && (
            <div className="p-6 flex flex-col h-full max-w-3xl mx-auto">
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Paste your notes or document text:
              </label>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste the context related to this flashcard..."
                className="w-full flex-1 min-h-[300px] p-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] resize-none focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm"
              />
              
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-border)]">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${shareWithCommunity ? 'bg-[var(--color-know)] text-[var(--color-bg)]' : 'border-2 border-[var(--color-text-muted)]'}`}>
                    {shareWithCommunity && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={shareWithCommunity}
                    onChange={(e) => setShareWithCommunity(e.target.checked)}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                      <Share2 size={14} />
                      Share with Community
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      Allow others to study this note for this flashcard
                    </span>
                  </div>
                </label>
                
                <button
                  onClick={handleSubmitPaste}
                  disabled={!pasteText.trim() || isUploading}
                  className="w-full sm:w-auto px-8 py-3 bg-[var(--color-accent)] text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isUploading ? 'Uploading...' : 'Generate Blanks'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'study' && (
            <div className="h-full">
              <FillInTheBlanksUI 
                tokens={studyTokens}
                onReset={() => setActiveTab('feed')} // repurpose Reset to just go back to feed
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
