'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { exportDeckToDOCX } from './exportToDOCX'
import { useToastStore } from '@/store/toastStore'

interface ExportButtonProps {
  deckId: string
  deckTitle: string
  variant?: 'icon' | 'full'
}

export default function ExportButton({ deckId, deckTitle, variant = 'icon' }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const addToast = useToastStore((s) => s.addToast)

  const handleExport = async () => {
    setLoading(true)
    try {
      await exportDeckToDOCX(deckId, deckTitle)
    } catch {
      addToast('Export failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        className="w-8 h-8 flex items-center justify-center text-white/85 hover:text-white active:scale-90 transition cursor-pointer"
        aria-label="Export deck as DOCX"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      </button>
    )
  }

  return (
    <button
      data-slot="button"
      data-variant="outline"
      onClick={handleExport}
      disabled={loading}
      className="h-12 px-5 w-full rounded-[16px] border-2 border-[#222536] bg-[#0b0c14] text-[#a855f7] font-extrabold text-[14px] uppercase tracking-wide shadow-[0px_4px_0px_0px_#141622] hover:bg-[#1a1c29] tactile-btn flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      Export DOCX
    </button>
  )
}
