'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react'
import { handleMultipleUpload } from './uploadHandler'
import { useToastStore } from '@/store/toastStore'

type UploadZoneState = 'idle' | 'dragover' | 'processing' | 'success' | 'error'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function UploadZone() {
  const router = useRouter()
  const addToast = useToastStore((s) => s.addToast)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadState, setUploadState] = useState<UploadZoneState>('idle')
  const [progressStep, setProgressStep] = useState('')
  const [deckId, setDeckId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const handleFilesAdded = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles)
    setSelectedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`))
      const toAdd = arr.filter((f) => !existingKeys.has(`${f.name}_${f.size}`))
      return [...prev, ...toAdd]
    })
    setErrorMessage('')
    setUploadState('idle')
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const processSelectedFiles = async () => {
    if (selectedFiles.length === 0) return

    const tooLarge = selectedFiles.find((f) => f.size > 25 * 1024 * 1024)
    if (tooLarge) {
      setUploadState('error')
      setErrorMessage(`File "${tooLarge.name}" exceeds 25MB limit`)
      return
    }

    setUploadState('processing')
    setProgressStep('')
    setErrorMessage('')

    try {
      const id = await handleMultipleUpload(selectedFiles, setProgressStep)
      setDeckId(id)
      setUploadState('success')
      addToast('Deck created successfully!', 'success')
    } catch (err) {
      setUploadState('error')
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed')
      addToast('Upload failed', 'error')
    }
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setUploadState('dragover')
  }

  const handleDragLeave = () => {
    setUploadState('idle')
  }

  const handleRetry = () => {
    if (selectedFiles.length > 0) {
      processSelectedFiles()
    } else {
      setUploadState('idle')
    }
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`bg-[#151722] rounded-2xl border-2 border-dashed p-8 md:p-12 text-center transition-all duration-200 ${
        uploadState === 'dragover'
          ? 'border-[var(--color-border-neon)] bg-[var(--color-accent-soft)] '
          : 'border-[var(--color-border-strong)]'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".csv,.docx,.txt,.pdf,.ppt,.pptx"
        className="hidden"
        onChange={handleFileSelect}
      />

      {uploadState === 'processing' ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-[var(--color-accent)]" />
          <p className="text-base font-medium text-[var(--color-text-primary)] animate-pulse">
            {progressStep || 'Processing files…'}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Transcribing materials and synthesizing with AI
          </p>
        </div>
      ) : uploadState === 'success' ? (
        <>
          <CheckCircle2 size={48} className="mx-auto text-[var(--color-know)]" />
          <p className="text-xl font-medium mt-4 text-[var(--color-text-primary)]">Deck ready!</p>
          <button
            onClick={() => router.push('/study/' + deckId)}
            className="bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl font-medium mt-4 hover:opacity-90 transition-opacity squishy-btn "
          >
            Open deck →
          </button>
        </>
      ) : uploadState === 'error' ? (
        <>
          <XCircle size={48} className="mx-auto text-[var(--color-dontknow)]" />
          <p className="text-sm text-[var(--color-dontknow)] mt-4">{errorMessage}</p>
          <button
            onClick={handleRetry}
            className="bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl font-medium mt-4 hover:opacity-90 transition-opacity squishy-btn "
          >
            Try again
          </button>
        </>
      ) : (
        <>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer"
          >
            <Upload size={48} className="mx-auto text-[var(--color-accent)]" />
            <p className="text-xl font-medium mt-4 text-[var(--color-text-primary)]">
              {uploadState === 'dragover' ? 'Drop files here' : 'Drop your files here or click to browse'}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              PDF, PPTX, DOCX, TXT, CSV &mdash; Select multiple documents/slides to combine into 1 deck
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
              className="bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl font-medium mt-4 hover:opacity-90 transition-opacity squishy-btn "
            >
              Choose files
            </button>
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-6 pt-6 border-t border-[var(--color-border)] text-left max-w-md mx-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Staged Files ({selectedFiles.length})
                </span>
                <button
                  type="button"
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
                        <p className="text-xs font-medium text-[var(--color-text-primary)] truncate max-w-[240px] sm:max-w-[280px]">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)]">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
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
                type="button"
                onClick={processSelectedFiles}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity squishy-btn  shadow-lg"
              >
                <Sparkles size={18} />
                Generate Unified Deck ({selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
