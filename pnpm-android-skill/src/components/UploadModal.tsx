'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, Sparkles, XCircle, FileText, Plus, Trash2, Eye } from 'lucide-react'
import { handleUpload, handleMultipleUpload, UploadError } from '@/features/upload/uploadHandler'
import { useToastStore } from '@/store/toastStore'
import { useUIStore } from '@/store/uiStore'
import { useCreditsStore } from '@/store/creditsStore'
import { openStripePayment } from '@/lib/stripePayment'
import { soundEngine } from '@/utils/soundEngine'

type UploadState = 'idle' | 'dragover' | 'processing' | 'success' | 'error'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function UploadModal() {
  const router = useRouter()
  const isOpen = useUIStore((s) => s.isUploadModalOpen)
  const tab = useUIStore((s) => s.uploadModalTab)
  const setTab = useUIStore((s) => s.setUploadModalTab)
  const closeUploadModal = useUIStore((s) => s.closeUploadModal)
  const addToast = useToastStore((s) => s.addToast)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [deckName, setDeckName] = useState('')
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [pasteText, setPasteText] = useState('')
  const [textLoading, setTextLoading] = useState(false)
  const [textProgress, setTextProgress] = useState('')
  const isPaid = useCreditsStore((s) => s.isPaidAccount)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewFileName, setPreviewFileName] = useState<string>('')

  const handlePreviewFile = async (file: File) => {
    soundEngine.play('poppy')
    setPreviewFileName(file.name)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'json' || ext === 'csv' || ext === 'txt' || file.type.startsWith('text/')) {
        const text = await file.text()
        setPreviewContent(text.slice(0, 6000) + (text.length > 6000 ? '\n\n...[Preview truncated for length]...' : ''))
      } else {
        setPreviewContent(`File: ${file.name} (${formatFileSize(file.size)})\nType: ${file.type || ext}\n\nDocument ready to parse.`)
      }
    } catch {
      setPreviewContent('Unable to preview file content directly.')
    }
  }

  if (!isOpen) return null

  const reset = () => {
    setDeckName('')
    setState('idle')
    setProgress('')
    setError('')
    setSelectedFiles([])
    setPasteText('')
    setTextLoading(false)
    setTextProgress('')
    setPreviewContent(null)
    setPreviewFileName('')
  }

  const handleClose = () => {
    soundEngine.play('thocky')
    closeUploadModal()
    reset()
  }

  const handleFilesAdded = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles)
    setSelectedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`))
      const toAdd = arr.filter((f) => !existingKeys.has(`${f.name}_${f.size}`))
      return [...prev, ...toAdd]
    })
    setError('')
    setState('idle')
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const processSelectedFiles = async () => {
    if (selectedFiles.length === 0) return
    soundEngine.play('poppy')
    const name = deckName.trim()

    const tooLarge = selectedFiles.find((f) => f.size > 25 * 1024 * 1024)
    if (tooLarge) {
      setState('error')
      setError(`File "${tooLarge.name}" exceeds 25MB limit`)
      return
    }

    setState('processing')
    setProgress('')
    setError('')

    try {
      const id = await handleMultipleUpload(selectedFiles, setProgress, name)
      addToast('Deck created!', 'success')
      closeUploadModal()
      reset()
      router.push('/study/' + id)
    } catch (err) {
      const message = err instanceof UploadError ? err.message : 'Upload failed'
      setState('error')
      setError(message)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setState('idle')
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(e.target.files)
      e.target.value = ''
    }
  }

  const handleRetry = () => {
    if (selectedFiles.length > 0) {
      processSelectedFiles()
    } else {
      setState('idle')
    }
  }

  const handleGenerate = async () => {
    let cleanText = pasteText.trim()
    if (!cleanText) return
    soundEngine.play('poppy')

    // 1. Strip any markdown code fences (```json, ```csv, or ```)
    if (cleanText.includes('```')) {
      const fenceMatch = cleanText.match(/```(?:json|csv)?\s*([\s\S]*?)\s*```/i)
      if (fenceMatch && fenceMatch[1]) {
        cleanText = fenceMatch[1].trim()
      } else {
        cleanText = cleanText.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim()
      }
    }

    // 2. JSON FIRST: check if the text is JSON or contains a JSON structure
    let isJson = false
    let cleanJsonPayload = cleanText

    if (cleanText.startsWith('{') || cleanText.startsWith('[')) {
      try {
        JSON.parse(cleanText)
        isJson = true
      } catch {
        isJson = true
      }
    } else {
      const match = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
      if (match) {
        try {
          JSON.parse(match[0])
          isJson = true
          cleanJsonPayload = match[0].trim()
        } catch {}
      }
    }

    const lines = cleanText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const rawFirstLine = lines[0] ?? ''
    const isCsv = !isJson && /^front[,\t]/i.test(rawFirstLine)

    const name = deckName.trim()
    setTextLoading(true)
    setTextProgress(isJson ? 'Parsing JSON deck...' : isCsv ? 'Parsing CSV deck...' : 'Generating deck...')
    try {
      const file = new File(
        [isJson ? cleanJsonPayload : cleanText],
        isJson ? 'deck.json' : isCsv ? 'deck.csv' : 'notes.txt',
        {
          type: isJson ? 'application/json' : isCsv ? 'text/csv' : 'text/plain',
        }
      )
      const id = await handleUpload(
        file,
        (step) => {
          setTextProgress(step)
        },
        name
      )
      addToast('Deck created!', 'success')
      closeUploadModal()
      reset()
      router.push('/study/' + id)
    } catch (err) {
      const message = err instanceof UploadError ? err.message : 'Failed to generate deck'
      addToast(message, 'error')
    } finally {
      setTextLoading(false)
      setTextProgress('')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#05060c]/75 backdrop-blur-[2px] animate-backdrop-fade-in"
      onClick={handleClose}
    >
      <div
        className="w-full sm:max-w-[420px] bg-[#0b0c14] border-2 border-[#222536] border-b-0 sm:border-b-2 rounded-t-[26px] sm:rounded-[26px] p-0 flex flex-col max-h-[92vh] overflow-hidden shadow-[0_-6px_24px_rgba(0,0,0,0.5)] sm:shadow-[0_8px_32px_rgba(0,0,0,0.6)] animate-drawer-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Drag Handle */}
        <div className="w-10 h-1 rounded-full bg-[#222536] mx-auto mt-2.5 shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between h-16 px-5 shrink-0">
          <h1 className="text-[24px] font-black tracking-[0.01em] uppercase text-white m-0">
            Create Deck
          </h1>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="w-11 h-11 rounded-[14px] border-2 border-[#222536] bg-[#1c1f2e] shadow-[0_3px_0_0_#121420] grid place-items-center p-0 tactile-btn cursor-pointer text-white"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="px-5 pb-7 overflow-y-auto no-scrollbar">
          {/* Segmented Pill Tabs */}
          <div className="p-1 rounded-[26px] bg-[#1a1c29] border-2 border-[#222536] flex gap-1">
            <button
              type="button"
              onClick={() => {
                soundEngine.play('thocky')
                setTab('text')
              }}
              className={`flex-1 h-11 rounded-[22px] border-0 text-xs font-black tracking-[0.08em] uppercase transition flex items-center justify-center gap-2 tactile-btn cursor-pointer ${
                tab === 'text'
                  ? 'bg-[#9333ea] text-white shadow-[0_3px_0_0_#6b21a8]'
                  : 'bg-transparent text-[#8e92a8] hover:text-white'
              }`}
            >
              Paste text
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.play('thocky')
                setTab('file')
              }}
              className={`flex-1 h-11 rounded-[22px] border-0 text-xs font-black tracking-[0.08em] uppercase transition flex items-center justify-center gap-2 tactile-btn cursor-pointer ${
                tab === 'file'
                  ? 'bg-[#9333ea] text-white shadow-[0_3px_0_0_#6b21a8]'
                  : 'bg-transparent text-[#8e92a8] hover:text-white'
              }`}
            >
              <span>Upload files</span>
              <span className="h-5 px-2 rounded-full bg-[#f59e0b] text-black text-[10px] font-black tracking-[0.06em] inline-flex items-center">
                PRO
              </span>
            </button>
          </div>

          {/* Deck Title Input */}
          <div className="mt-5">
            <label
              htmlFor="deck-title-input"
              className="block text-xs font-black tracking-[0.08em] uppercase text-white mb-2"
            >
              Deck title
            </label>
            <input
              id="deck-title-input"
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="Optional"
              className="w-full h-12 px-4 rounded-[16px] border-2 border-[#222536] bg-[#1a1c29] text-white text-base font-semibold placeholder:text-[#8e92a8] outline-none focus:border-[#9333ea] transition"
            />
          </div>

          {/* Tab 1: Upload Files */}
          {tab === 'file' ? (
            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".csv,.json,.docx,.txt,.pdf,.ppt,.pptx"
                className="hidden"
                onChange={handleFileSelect}
              />

              {state === 'processing' ? (
                <div className="rounded-[18px] border-2 border-[#222536] bg-[#151722] shadow-[0_6px_0_0_#141622] p-8 text-center flex flex-col items-center gap-3">
                  <Loader2 size={32} className="animate-spin text-[#c084fc]" />
                  <p className="text-sm font-black tracking-[0.06em] uppercase text-white">
                    {progress || 'Processing files...'}
                  </p>
                </div>
              ) : state === 'error' ? (
                <div className="rounded-[18px] border-2 border-[#222536] bg-[#151722] shadow-[0_6px_0_0_#141622] p-6 text-center">
                  <XCircle size={36} className="mx-auto text-[#ff5252]" />
                  <p className="text-xs text-[#ff5252] font-bold mt-2.5">{error}</p>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="mt-4 px-5 py-2.5 rounded-[14px] border-2 border-[#222536] bg-[#1c1f2e] text-white font-black text-xs uppercase tracking-wider tactile-btn"
                  >
                    Try again
                  </button>
                </div>
              ) : !isPaid ? (
                /* Free Account Locked State from Redesign */
                <>
                  <div className="mt-4 rounded-[18px] border-2 border-dashed border-[#2f3350] bg-[#151722] shadow-[0_6px_0_0_#141622] py-8 px-5 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-[16px] bg-[#9333ea]/15 border-2 border-[#9333ea]/30 grid place-items-center text-[#c084fc]">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#c084fc"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="5" y="11" width="14" height="9" rx="2.5" />
                        <path d="M8 11V8a4 4 0 018 0v3" />
                      </svg>
                    </div>
                    <div className="mt-4 text-sm font-black tracking-[0.06em] uppercase text-white max-w-[240px] leading-snug">
                      Sending files is a Pro feature
                    </div>
                    <p className="mt-1.5 text-xs text-[#8e92a8] font-bold max-w-[260px] leading-relaxed">
                      File uploads are exclusive to StudyUp Pro subscribers. Paste text is completely free to use.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('poppy')
                      openStripePayment()
                    }}
                    className="mt-6 w-full h-14 rounded-[16px] border-2 border-[#9333ea] bg-[#9333ea] text-white text-base font-black tracking-[0.06em] uppercase shadow-[0_5px_0_0_#6b21a8] tactile-btn flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Upgrade to Pro
                  </button>
                </>
              ) : (
                /* Paid / Pro Upload UI */
                <>
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setState('dragover')
                    }}
                    onDragLeave={() => setState('idle')}
                    onClick={() => fileInputRef.current?.click()}
                    className={`rounded-[18px] border-2 border-dashed p-6 text-center transition cursor-pointer shadow-[0_6px_0_0_#141622] ${
                      state === 'dragover'
                        ? 'border-[#9333ea] bg-[#201833]'
                        : 'border-[#2f3350] hover:border-[#9333ea] bg-[#151722]'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-[16px] bg-[#9333ea]/15 border-2 border-[#9333ea]/30 grid place-items-center text-[#c084fc] mx-auto mb-2">
                      <Upload size={22} />
                    </div>
                    <p className="text-sm font-black tracking-[0.06em] uppercase text-white">
                      {state === 'dragover' ? 'Drop files here' : 'Tap or drop files here'}
                    </p>
                    <p className="text-xs text-[#8e92a8] font-bold uppercase tracking-wider mt-1">
                      PDF, PPTX, DOCX, TXT, CSV, JSON
                    </p>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="mt-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-[#8e92a8]">
                          Files ({selectedFiles.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs text-[#c084fc] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={14} /> Add more
                        </button>
                      </div>

                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                        {selectedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2.5 rounded-[14px] bg-[#1a1c29] border-2 border-[#222536]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileText size={16} className="text-[#c084fc] shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate max-w-[210px]">
                                  {file.name}
                                </p>
                                <p className="text-[10px] font-semibold text-[#8e92a8]">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handlePreviewFile(file)}
                                className="p-1.5 text-[#8e92a8] hover:text-[#c084fc] transition cursor-pointer"
                                title="View file"
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(idx)}
                                className="p-1.5 text-[#8e92a8] hover:text-[#ff5252] transition cursor-pointer"
                                title="Remove"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {previewContent !== null && (
                        <div className="mt-3 p-3.5 rounded-[16px] bg-[#1a1c29] border-2 border-[#9333ea]/40">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222536]">
                            <span className="text-xs font-bold text-[#c084fc] truncate max-w-[240px]">
                              {previewFileName}
                            </span>
                            <button
                              type="button"
                              onClick={() => setPreviewContent(null)}
                              className="text-xs text-[#8e92a8] hover:text-white font-black cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                          <pre className="text-[11.5px] font-mono text-[#cbd5e1] max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed no-scrollbar select-text">
                            {previewContent}
                          </pre>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={processSelectedFiles}
                        className="mt-4 w-full h-14 rounded-[16px] border-2 border-[#9333ea] bg-[#9333ea] text-white text-base font-black tracking-[0.06em] uppercase shadow-[0_5px_0_0_#6b21a8] tactile-btn flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Sparkles size={18} />
                        <span>Generate Deck ({selectedFiles.length})</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* Tab 2: Paste Text */
            <div className="mt-4">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your study notes, JSON flashcards, or CSV here..."
                rows={6}
                className="w-full h-36 px-4 py-3 rounded-[18px] border-2 border-[#222536] bg-[#1a1c29] text-white text-sm font-medium placeholder:text-[#8e92a8] focus:border-[#9333ea] focus:outline-none resize-none transition"
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={textLoading || !pasteText.trim()}
                className="mt-5 w-full h-14 rounded-[16px] border-2 border-[#9333ea] bg-[#9333ea] text-white text-base font-black tracking-[0.06em] uppercase shadow-[0_5px_0_0_#6b21a8] disabled:opacity-45 disabled:cursor-not-allowed tactile-btn flex items-center justify-center gap-2 cursor-pointer"
              >
                {textLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Sparkles size={18} />
                )}
                <span>{textLoading ? 'Generating Deck...' : 'Generate Deck'}</span>
              </button>

              {textLoading && textProgress && (
                <div className="mt-3 p-3 rounded-[14px] bg-[#151722] border-2 border-[#222536] text-xs font-bold text-[#8e92a8] text-center flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin text-[#c084fc]" />
                  <span>{textProgress}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
