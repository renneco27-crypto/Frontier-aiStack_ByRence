'use client'

import { useState } from 'react'
import { X, ClipboardPaste } from 'lucide-react'

interface PastePopupProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (title: string, text: string) => void
}

export default function PastePopup({ isOpen, onClose, onSubmit }: PastePopupProps) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 ">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
          <h2 className="text-lg font-medium text-[var(--color-text-primary)] flex items-center gap-2">
            <ClipboardPaste size={20} />
            Paste Document
          </h2>
          <button 
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1 rounded-md hover:bg-[var(--color-surface-3)]"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 flex-1 flex flex-col min-h-0 gap-3">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chapter 1 Notes"
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>
          <div className="flex-1 flex flex-col min-h-0">
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1 mt-2">
              Content
            </label>
            <p className="text-xs text-[var(--color-text-muted)] mb-2">
              Paste your notes or document below. We will randomly generate fill-in-the-blanks for you to study.
            </p>
            <textarea
              className="w-full flex-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl p-4 text-sm text-[var(--color-text-primary)] resize-none focus:outline-none focus:border-[var(--color-accent)] transition-colors min-h-[200px]"
              placeholder="Paste text here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>
        
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (text.trim() && title.trim()) {
                onSubmit(title.trim(), text.trim())
                setText('')
                setTitle('')
              }
            }}
            disabled={!text.trim() || !title.trim()}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-sm"
          >
            Generate Blanks
          </button>
        </div>
      </div>
    </div>
  )
}
