'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Image as ImageIcon,
  Upload,
  Plus,
  Search,
  Trash2,
  Edit2,
  Maximize2,
  X,
  CheckSquare,
  Square,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react'
import StudyHeader, { HeaderIconButton } from '@/components/StudyHeader'
import { getDeck } from '@/db/deckRepository'
import {
  createImage,
  bulkCreateImages,
  getImagesByDeck,
  updateImage,
  deleteImage,
  bulkDeleteImages
} from '@/db/imageRepository'
import { useToastStore } from '@/store/toastStore'
import type { Deck, DeckImage } from '@/lib/zodSchemas'

// Client-side image compression helper to keep IndexedDB lean
async function compressImageFile(file: File, maxDim = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(e.target?.result as string)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        const format = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        resolve(canvas.toDataURL(format, quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ImagesClient({ deckId: propDeckId }: { deckId?: string }) {
  const router = useRouter()
  const params = useParams()
  const addToast = useToastStore((s) => s.addToast)
  const routeDeckId = (params?.deckId as string | undefined) || ''
  const urlDeckId = typeof window !== 'undefined'
    ? (window.location.pathname.split('/study/')[1]?.split('/')[0]?.split('?')[0] || '')
    : ''
  const storedDeckId = typeof window !== 'undefined'
    ? (localStorage.getItem('studyup_active_deck_id') || '')
    : ''

  const deckId = (propDeckId && propDeckId !== '_offline')
    ? propDeckId
    : (routeDeckId && routeDeckId !== '_offline')
      ? routeDeckId
      : (urlDeckId && urlDeckId !== '_offline')
        ? urlDeckId
        : storedDeckId

  const [deck, setDeck] = useState<Deck | null>(null)
  const [images, setImages] = useState<DeckImage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCaption, setUploadCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Edit Modal State
  const [editingImage, setEditingImage] = useState<DeckImage | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCaption, setEditCaption] = useState('')
  const [updating, setUpdating] = useState(false)

  // Lightbox Fullscreen State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)

  // In-app Delete Confirmation Modal
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean
    ids: string[]
    description: string
  } | null>(null)

  const loadData = useCallback(async () => {
    if (!deckId || deckId === '_offline') {
      setLoading(false)
      return
    }
    try {
      const [d, imgList] = await Promise.all([getDeck(deckId), getImagesByDeck(deckId)])
      setDeck(d ?? null)

      if (imgList && imgList.length > 0) {
        setImages(imgList)
      } else if (d?.sourceJson) {
        // Self-heal: extract images from deck sourceJson if IndexedDB gallery was empty
        try {
          const rawObj = JSON.parse(d.sourceJson)
          if (Array.isArray(rawObj.images) && rawObj.images.length > 0) {
            const healed: DeckImage[] = rawObj.images.map((img: any, idx: number) => ({
              id: img.id || `img-heal-${Date.now()}-${idx}`,
              deckId,
              title: img.title || `Visual Reference ${idx + 1}`,
              caption: img.caption,
              dataUrl: img.dataUrl || img.url || '',
              createdAt: new Date().toISOString(),
            }))
            await bulkCreateImages(healed)
            setImages(healed)
          } else {
            setImages([])
          }
        } catch {
          setImages([])
        }
      } else {
        setImages([])
      }
    } catch (err) {
      console.warn('Failed to load gallery:', err)
      addToast('Failed to load gallery', 'error')
    } finally {
      setLoading(false)
    }
  }, [deckId, addToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // File Select & Drag-and-Drop
  const handleFileChange = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast('Please select a valid image file', 'error')
      return
    }
    setUploadFile(file)
    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
    setUploadTitle(baseName)
    try {
      const compressed = await compressImageFile(file)
      setUploadPreview(compressed)
    } catch {
      addToast('Failed to process image', 'error')
    }
  }

  const handleUploadSubmit = async () => {
    if (!uploadPreview || !uploadTitle.trim()) {
      addToast('Image and title are required', 'error')
      return
    }
    setUploading(true)
    try {
      const newImg: DeckImage = {
        id: crypto.randomUUID(),
        deckId,
        title: uploadTitle.trim(),
        caption: uploadCaption.trim() || undefined,
        dataUrl: uploadPreview,
        createdAt: new Date().toISOString(),
      }
      await createImage(newImg)
      setImages((prev) => [newImg, ...prev])
      addToast('Photo uploaded successfully', 'success')
      setShowUploadModal(false)
      setUploadFile(null)
      setUploadPreview(null)
      setUploadTitle('')
      setUploadCaption('')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  // Edit Action
  const handleOpenEdit = (img: DeckImage, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingImage(img)
    setEditTitle(img.title)
    setEditCaption(img.caption || '')
  }

  const handleSaveEdit = async () => {
    if (!editingImage || !editTitle.trim()) return
    setUpdating(true)
    try {
      await updateImage(editingImage.id, {
        title: editTitle.trim(),
        caption: editCaption.trim() || undefined,
      })
      setImages((prev) =>
        prev.map((img) =>
          img.id === editingImage.id
            ? { ...img, title: editTitle.trim(), caption: editCaption.trim() || undefined }
            : img
        )
      )
      addToast('Photo details updated', 'success')
      setEditingImage(null)
    } catch {
      addToast('Failed to update photo', 'error')
    } finally {
      setUpdating(false)
    }
  }

  // Delete Action
  const promptDeleteSingle = (img: DeckImage, e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmDeleteModal({
      isOpen: true,
      ids: [img.id],
      description: `"${img.title}"`,
    })
  }

  const promptDeleteBulk = () => {
    if (selectedIds.size === 0) return
    setConfirmDeleteModal({
      isOpen: true,
      ids: Array.from(selectedIds),
      description: `${selectedIds.size} selected photo${selectedIds.size !== 1 ? 's' : ''}`,
    })
  }

  const executeDelete = async () => {
    if (!confirmDeleteModal || confirmDeleteModal.ids.length === 0) return
    const ids = confirmDeleteModal.ids
    try {
      if (ids.length === 1) {
        await deleteImage(ids[0])
      } else {
        await bulkDeleteImages(ids)
      }
      setImages((prev) => prev.filter((img) => !ids.includes(img.id)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
      addToast(
        ids.length === 1 ? 'Photo deleted' : `${ids.length} photos deleted`,
        'success'
      )
      setConfirmDeleteModal(null)
      if (lightboxIndex !== null) setLightboxIndex(null)
    } catch {
      addToast('Failed to delete photo(s)', 'error')
    }
  }

  // Multi-select helpers
  const toggleSelectCard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = images.filter(
    (img) =>
      !search ||
      img.title.toLowerCase().includes(search.toLowerCase()) ||
      img.caption?.toLowerCase().includes(search.toLowerCase())
  )

  const toggleSelectAll = () => {
    const allFilteredIds = filtered.map((i) => i.id)
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

  // Lightbox Navigation
  const activeLightboxImage = lightboxIndex !== null ? filtered[lightboxIndex] : null

  const handleNextLightbox = () => {
    if (lightboxIndex !== null && lightboxIndex < filtered.length - 1) {
      setLightboxIndex(lightboxIndex + 1)
      setZoomLevel(1)
    }
  }

  const handlePrevLightbox = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1)
      setZoomLevel(1)
    }
  }

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNextLightbox()
      if (e.key === 'ArrowLeft') handlePrevLightbox()
      if (e.key === 'Escape') setLightboxIndex(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxIndex, filtered.length])

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <div className="max-w-6xl w-full mx-auto px-4 pt-2">
        <StudyHeader
          title={deck ? `${deck.title} · Gallery` : 'Gallery'}
          closeIcon="back"
          onClose={() => router.push(`/study/${deckId}`)}
          rightSlot={
            <HeaderIconButton
              onClick={() => setShowUploadModal(true)}
              title="Add Photo"
            >
              <Plus size={19} />
            </HeaderIconButton>
          }
        />
      </div>

      {/* Control Bar: Search & Multi-select */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/50  sticky top-14 z-20">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search photos, diagrams, notes…"
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs sm:text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          {filtered.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors shrink-0"
              title="Select/Deselect all"
            >
              <CheckSquare size={14} />
              <span className="hidden sm:inline">Select All</span>
            </button>
          )}

          {selectedIds.size > 0 && (
            <button
              onClick={promptDeleteBulk}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[var(--color-dontknow)] text-white hover:opacity-90 transition-opacity shrink-0 shadow-sm"
            >
              <Trash2 size={14} />
              <span>Delete ({selectedIds.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Gallery */}
      <div className="flex-1 p-4 max-w-6xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-[var(--color-text-muted)]">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading photos…
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] mb-4 text-[var(--color-accent)]">
              <ImageIcon size={36} />
            </div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
              No photos in this deck yet
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-sm mb-6">
              Upload diagrams, cheatsheets, formulas, and anatomical charts to study visually offline.
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-white font-medium text-sm hover:opacity-90 transition-opacity shadow-sm"
            >
              <Upload size={16} /> Upload First Photo
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-sm text-[var(--color-text-muted)]">
            No photos found matching "{search}"
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-12">
            {filtered.map((img, idx) => {
              const isSelected = selectedIds.has(img.id)

              return (
                <div
                  key={img.id}
                  onClick={() => {
                    setLightboxIndex(idx)
                    setZoomLevel(1)
                  }}
                  className={`bg-[#151722] rounded-2xl border overflow-hidden flex flex-col cursor-pointer group transition-all duration-200 shadow-sm hover:shadow-md hover:border-[var(--color-border-neon)] ${
                    isSelected
                      ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]'
                      : 'border-[var(--color-border)]'
                  }`}
                >
                  {/* Thumbnail Image Container */}
                  <div className="relative aspect-[4/3] bg-black/30 overflow-hidden">
                    <img
                      src={img.dataUrl}
                      alt={img.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* Top Overlay: Checkbox & Quick Actions */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex items-start justify-between">
                      <button
                        onClick={(e) => toggleSelectCard(img.id, e)}
                        className="p-1 rounded-lg bg-black/50 text-white hover:bg-[var(--color-accent)] transition-colors"
                        title="Select photo"
                      >
                        {isSelected ? (
                          <CheckSquare size={16} className="text-[var(--color-accent)]" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleOpenEdit(img, e)}
                          className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-[var(--color-surface-2)] transition-colors"
                          title="Edit details"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => promptDeleteSingle(img, e)}
                          className="p-1.5 rounded-lg bg-black/60 text-[var(--color-dontknow)] hover:bg-[var(--color-dontknow)] hover:text-white transition-colors"
                          title="Delete photo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Expand icon bottom right */}
                    <div className="absolute bottom-2 right-2 p-1 rounded-lg bg-black/60 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 size={13} />
                    </div>
                  </div>

                  {/* Card Info */}
                  <div className="p-3 bg-[var(--color-surface)] flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-1">
                        {img.title}
                      </h3>
                      {img.caption && (
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2 leading-relaxed">
                          {img.caption}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--color-text-muted)] mt-2 font-mono">
                      {new Date(img.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70  animate-in fade-in duration-150"
          onClick={() => !uploading && setShowUploadModal(false)}
        >
          <div
            className="bg-[#151722] rounded-2xl border border-[var(--color-border)] w-full max-w-lg p-5 sm:p-6  shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
                  <Upload size={18} />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] font-display">
                  Upload Photo / Diagram
                </h2>
              </div>
              <button
                onClick={() => !uploading && setShowUploadModal(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
              >
                <X size={18} />
              </button>
            </div>

            {/* File Drop Area */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileChange(file)
                }}
              />

              {uploadPreview ? (
                <div className="relative rounded-xl border border-[var(--color-border)] overflow-hidden aspect-[16/9] bg-black/40 group">
                  <img
                    src={uploadPreview}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-medium  transition-colors"
                    >
                      Change Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadFile(null)
                        setUploadPreview(null)
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-500/30 hover:bg-red-500/50 text-white text-xs font-medium  transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const file = e.dataTransfer.files?.[0]
                    if (file) handleFileChange(file)
                  }}
                  className="rounded-2xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] p-8 text-center cursor-pointer transition-colors bg-[var(--color-surface-2)]/40 hover:bg-[var(--color-surface-2)] flex flex-col items-center justify-center"
                >
                  <div className="p-3 rounded-full bg-[var(--color-surface)] text-[var(--color-accent)] mb-2 shadow-sm">
                    <ImageIcon size={28} />
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Click to select or drag and drop photo
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    PNG, JPG, WEBP, SVG (Auto-compressed for fast offline recall)
                  </p>
                </div>
              )}
            </div>

            {/* Title & Caption */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                  Title / Subject *
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Heart Anatomy, Newton's Laws Chart"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                  Caption / Study Notes (Optional)
                </label>
                <textarea
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  placeholder="Add notes, key highlights, formulas, or context for this photo…"
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={uploading || !uploadPreview || !uploadTitle.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading ? 'Saving…' : 'Upload Photo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Details Modal */}
      {editingImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70  animate-in fade-in duration-150"
          onClick={() => !updating && setEditingImage(null)}
        >
          <div
            className="bg-[#151722] rounded-2xl border border-[var(--color-border)] w-full max-w-md p-5 sm:p-6  shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
                  <Edit2 size={16} />
                </div>
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                  Edit Photo Details
                </h2>
              </div>
              <button
                onClick={() => !updating && setEditingImage(null)}
                className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                  Caption / Study Notes
                </label>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => setEditingImage(null)}
                disabled={updating}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={updating || !editTitle.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
              >
                {updating ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Fullscreen Modal */}
      {activeLightboxImage && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95  animate-in fade-in duration-200"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Lightbox Top Header */}
          <div
            className="p-3 sm:p-4 flex items-center justify-between border-b border-white/10 bg-black/40 text-white shrink-0 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 min-w-0 pr-4">
              <h2 className="text-sm sm:text-base font-bold truncate">
                {activeLightboxImage.title}
              </h2>
              <span className="text-[11px] text-white/60 font-mono">
                {lightboxIndex + 1} of {filtered.length}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Reset Zoom"
              >
                <RotateCcw size={16} />
              </button>
              <a
                href={activeLightboxImage.dataUrl}
                download={`${activeLightboxImage.title}.jpg`}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Download Photo"
              >
                <Download size={16} />
              </a>
              <button
                onClick={() => setLightboxIndex(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors ml-1"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Lightbox Center Image with Nav */}
          <div
            className="flex-1 relative flex items-center justify-center p-4 overflow-hidden select-none"
            onClick={() => setLightboxIndex(null)}
          >
            {/* Prev Button */}
            {lightboxIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handlePrevLightbox()
                }}
                className="absolute left-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors shadow-lg"
                title="Previous photo"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            {/* Main Image */}
            <div
              className="max-w-full max-h-full flex items-center justify-center overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={activeLightboxImage.dataUrl}
                alt={activeLightboxImage.title}
                style={{ transform: `scale(${zoomLevel})` }}
                className="max-h-[75vh] max-w-[90vw] object-contain transition-transform duration-150 rounded-lg shadow-2xl"
              />
            </div>

            {/* Next Button */}
            {lightboxIndex < filtered.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleNextLightbox()
                }}
                className="absolute right-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors shadow-lg"
                title="Next photo"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Lightbox Bottom Caption */}
          {activeLightboxImage.caption && (
            <div
              className="p-3 sm:p-4 border-t border-white/10 bg-black/60 text-white/90 text-xs sm:text-sm text-center max-h-24 overflow-y-auto shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {activeLightboxImage.caption}
            </div>
          )}
        </div>
      )}

      {/* In-app Confirmation Modal for Delete */}
      {confirmDeleteModal?.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70  animate-in fade-in duration-150"
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
                Delete {confirmDeleteModal.ids.length === 1 ? 'Photo' : `${confirmDeleteModal.ids.length} Photos`}?
              </h3>
            </div>

            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-[var(--color-text-primary)]">{confirmDeleteModal.description}</span>? This cannot be undone.
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
