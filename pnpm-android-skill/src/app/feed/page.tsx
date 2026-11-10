'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Download, BookOpen,
  Folder, FolderOpen, Plus, X, ChevronDown, Trash2, Search,
  Layers, Undo2, CheckSquare, Square, Bell,
} from 'lucide-react'
import { parseCSVFile } from '@/features/upload/csvParser'
import { auditAndFixCSV } from '@/features/upload/csvFixer'
import { parseJSONDeckContent } from '@/features/upload/jsonParser'
import { createDeck, getAllDecks } from '@/db/deckRepository'
import { createCards } from '@/db/cardRepository'
import { saveNativeDeckCSV } from '@/lib/nativeDeckBridge'
import { useToastStore } from '@/store/toastStore'
import { useUIStore } from '@/store/uiStore'
import { useProcessingJobsStore } from '@/store/processingJobsStore'
import { createBrowserSupabase } from '@/lib/supabase'
import { soundEngine } from '@/utils/soundEngine'
import { apiUrl } from '@/lib/apiBase'

interface FeedDeck {
  id: string
  title: string
  subject: string
  author_name: string
  published_at: string
  download_count: number
}

interface FolderItem {
  id: string
  name: string
  created_by: string
  created_at: string
  deck_count: number
}

export default function FeedPage() {
  const router = useRouter()
  const addToast = useToastStore((s) => s.addToast)
  const { openDrawer, openNotificationPanel } = useUIStore()
  const hasActiveJobs = useProcessingJobsStore((s) => s.jobs.some((j) => j.status === 'processing'))
  const [decks, setDecks] = useState<FeedDeck[]>([])
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [addedDeckIds, setAddedDeckIds] = useState<Record<string, string>>({})
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creating, setCreating] = useState(false)
  const [categorizingId, setCategorizingId] = useState<string | null>(null)
  const [openCategorizeDeckId, setOpenCategorizeDeckId] = useState<string | null>(null)
  const [folderDecks, setFolderDecks] = useState<FeedDeck[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [savingTitleId, setSavingTitleId] = useState<string | null>(null)

  // Deck Merge & Unmerge State
  const [selectedDeckIds, setSelectedDeckIds] = useState<Set<string>>(new Set())
  const [isMergeMode, setIsMergeMode] = useState(false)
  const [isMergingDecks, setIsMergingDecks] = useState(false)
  const [unmergingDeckId, setUnmergingDeckId] = useState<string | null>(null)
  const [showMergePrompt, setShowMergePrompt] = useState(false)
  const [customMergeTitle, setCustomMergeTitle] = useState('')
  const [unmergingConfirmDeck, setUnmergingConfirmDeck] = useState<FeedDeck | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (!(e.target as HTMLElement)?.closest?.('.categorize-dropdown-container')) {
        setOpenCategorizeDeckId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  const fetchFeed = useCallback(async () => {
    // 1. Immediately hydrate from offline cache if available
    try {
      const cached = typeof window !== 'undefined' ? localStorage.getItem('studyup_cached_feed_decks') : null
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDecks(parsed)
        }
      }
    } catch {}

    try {
      const res = await fetch(apiUrl('/api/feed'))
      if (!res.ok) throw new Error('Failed to load feed')
      const text = await res.text()
      let data: any
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error('Invalid feed response format')
      }
      const fetchedDecks: FeedDeck[] = data.decks ?? []
      setDecks(fetchedDecks)
      try {
        localStorage.setItem('studyup_cached_feed_decks', JSON.stringify(fetchedDecks))
      } catch {}

      const localDecks = await getAllDecks()
      const localByTitle = new Map(localDecks.map((d) => [d.title, d.id]))
      const preAdded = new Set<string>()
      const preAddedDeckIds: Record<string, string> = {}
      for (const d of fetchedDecks) {
        const localId = localByTitle.get(d.title)
        if (localId) {
          preAdded.add(d.id)
          preAddedDeckIds[d.id] = localId
        }
      }
      setAddedIds(preAdded)
      setAddedDeckIds(preAddedDeckIds)
    } catch (err) {
      // Offline fallback: load cached feed decks so user never sees a broken page
      try {
        const cached = typeof window !== 'undefined' ? localStorage.getItem('studyup_cached_feed_decks') : null
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDecks(parsed)
            return
          }
        }
      } catch {}
      if (!navigator.onLine) return
      addToast(err instanceof Error ? err.message : 'Failed to load feed', 'error')
    }
  }, [addToast])

  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/folders'))
      if (!res.ok) throw new Error('Failed to load folders')
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setFolders(data)
        try { localStorage.setItem('studyup_cached_feed_folders', JSON.stringify(data)) } catch {}
      } else {
        const cached = typeof window !== 'undefined' ? localStorage.getItem('studyup_cached_feed_folders') : null
        if (cached) {
          try { setFolders(JSON.parse(cached)) } catch {}
        } else {
          setFolders([
            { id: '9dbef8a6-bbc7-4dad-a37e-aa0aa5758419', name: 'maee', created_by: '8400369e-08ad-4bc0-b8ac-26f8bddcdbbf', created_at: '2026-08-14T07:59:04.667409+00:00', deck_count: 2 },
            { id: 'c3aebe89-8abf-46e2-972d-f1133137ffcb', name: 'Lawrence', created_by: '11cfc55a-bed4-4310-8ab9-eb4c6fd6ecf2', created_at: '2026-09-20T18:08:11.036935+00:00', deck_count: 0 },
          ])
        }
      }
    } catch (err) {
      const cached = typeof window !== 'undefined' ? localStorage.getItem('studyup_cached_feed_folders') : null
      if (cached) {
        try { setFolders(JSON.parse(cached)) } catch {}
      } else {
        setFolders([
          { id: '9dbef8a6-bbc7-4dad-a37e-aa0aa5758419', name: 'maee', created_by: '8400369e-08ad-4bc0-b8ac-26f8bddcdbbf', created_at: '2026-08-14T07:59:04.667409+00:00', deck_count: 2 },
          { id: 'c3aebe89-8abf-46e2-972d-f1133137ffcb', name: 'Lawrence', created_by: '11cfc55a-bed4-4310-8ab9-eb4c6fd6ecf2', created_at: '2026-09-20T18:08:11.036935+00:00', deck_count: 0 },
        ])
      }
    }
  }, [])

  const fetchFolderDecks = useCallback(async (folderId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/folders/${folderId}/decks`))
      if (!res.ok) throw new Error('Failed to load folder decks')
      const data = await res.json()
      setFolderDecks(data ?? [])
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load folder decks', 'error')
      setFolderDecks([])
    }
  }, [addToast])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const [, , sessionData] = await Promise.all([
        fetchFeed(),
        fetchFolders(),
        fetch('/api/session').then((r) => r.json()).catch(() => null),
      ])
      if (sessionData?.isAdmin) setIsAdmin(true)
      setLoading(false)
    }
    init()
  }, [fetchFeed, fetchFolders])

  useEffect(() => {
    if (activeFolder) {
      fetchFolderDecks(activeFolder)
    }
  }, [activeFolder, fetchFolderDecks])

  const handleToggleSelectDeck = (deckId: string) => {
    soundEngine.play('thocky')
    setSelectedDeckIds((prev) => {
      const next = new Set(prev)
      if (next.has(deckId)) {
        next.delete(deckId)
      } else {
        if (next.size >= 2) {
          addToast('Select up to 2 decks to merge', 'info')
          return prev
        }
        next.add(deckId)
      }
      return next
    })
  }

  const handleMergeDecks = async () => {
    if (selectedDeckIds.size < 2) {
      addToast('Select 2 decks to merge', 'error')
      return
    }
    setIsMergingDecks(true)
    try {
      const res = await fetch('/api/feed/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceDeckIds: Array.from(selectedDeckIds),
          customTitle: customMergeTitle.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to merge decks')
      }
      addToast('Decks merged!', 'success')
      setSelectedDeckIds(new Set())
      setShowMergePrompt(false)
      setCustomMergeTitle('')
      await fetchFeed()
    } catch (err: any) {
      addToast(err?.message || 'Failed to merge decks', 'error')
    } finally {
      setIsMergingDecks(false)
    }
  }

  const handleUnmergeDeck = async (deckId: string) => {
    setUnmergingDeckId(deckId)
    try {
      const res = await fetch('/api/feed/unmerge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mergedDeckId: deckId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to unmerge deck')
      }
      addToast('Deck unmerged!', 'success')
      await fetchFeed()
    } catch (err: any) {
      addToast(err?.message || 'Failed to unmerge deck', 'error')
    } finally {
      setUnmergingDeckId(null)
    }
  }

  const handleRenameTitle = async (deck: FeedDeck, newTitle: string) => {
    const trimmed = newTitle.trim()
    setEditingTitleId(null)
    if (!trimmed || trimmed === deck.title) return
    setSavingTitleId(deck.id)
    try {
      const res = await fetch(`/api/feed/${deck.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to rename')
      }
      setDecks((prev) => prev.map((d) => (d.id === deck.id ? { ...d, title: trimmed } : d)))
      setFolderDecks((prev) => prev.map((d) => (d.id === deck.id ? { ...d, title: trimmed } : d)))
      addToast('Deck renamed!', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to rename deck', 'error')
    } finally {
      setSavingTitleId(null)
    }
  }

  const handleAddToApp = async (feedDeck: FeedDeck) => {
    soundEngine.play('poppy')
    setAddingId(feedDeck.id)
    try {
      const res = await fetch(apiUrl(`/api/feed/${feedDeck.id}`))
      if (!res.ok) throw new Error('Deck not found')
      const text = await res.text()
      let data: any
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error('Server returned an unexpected response format')
      }

      const rawContent = data.csv_content || data.json_content || ''
      if (!rawContent) throw new Error('Deck content is empty')

      let parsed: { deck: any; cards: any[] }
      if (rawContent.trim().startsWith('{') || rawContent.trim().startsWith('[')) {
        try {
          parsed = parseJSONDeckContent(rawContent, data.title, data.subject)
        } catch {
          parsed = parseCSVFile(auditAndFixCSV(rawContent), data.title)
        }
      } else {
        parsed = parseCSVFile(auditAndFixCSV(rawContent), data.title)
      }

      const deckId = await createDeck(parsed.deck)
      const cardsWithDeckId = parsed.cards.map((c) => ({ ...c, deckId }))
      await createCards(cardsWithDeckId)

      saveNativeDeckCSV(deckId, data.title, rawContent, data.subject).catch(() => {})

      setAddedIds((prev) => new Set(prev).add(feedDeck.id))
      setAddedDeckIds((prev) => ({ ...prev, [feedDeck.id]: deckId }))
      addToast('Saved offline to Library!', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to add deck', 'error')
    } finally {
      setAddingId(null)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    setCreating(true)
    try {
      const sessionRes = await fetch('/api/session')
      const sessionData = await sessionRes.json().catch(() => null)
      const createdBy = sessionData?.user?.id ?? ''

      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), createdBy }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to create folder')
      }
      setNewFolderName('')
      setShowNewFolder(false)
      await fetchFolders()
      addToast('Folder created!', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to create folder', 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleAddToFolder = async (folderId: string, deckId: string) => {
    setCategorizingId(deckId)
    try {
      const res = await fetch(`/api/folders/${folderId}/decks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to categorize')
      }
      if (activeFolder === null) {
        setDecks((prev) => prev.filter((d) => d.id !== deckId))
      }
      await fetchFolders()
      addToast('Deck categorized!', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to categorize deck', 'error')
    } finally {
      setCategorizingId(null)
    }
  }

  const handleRemoveFromFolder = async (deckId: string) => {
    if (!activeFolder) return
    setCategorizingId(deckId)
    try {
      const res = await fetch(`/api/folders/${activeFolder}/decks`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId }),
      })
      if (!res.ok) throw new Error('Failed to remove')
      setFolderDecks((prev) => prev.filter((d) => d.id !== deckId))
      await fetchFolders()
      addToast('Moved back to feed', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to remove deck', 'error')
    } finally {
      setCategorizingId(null)
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    try {
      const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete folder')
      if (activeFolder === folderId) setActiveFolder(null)
      await Promise.all([fetchFeed(), fetchFolders()])
      addToast('Folder deleted', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete folder', 'error')
    }
  }

  const handleDeleteDeck = async (deckId: string) => {
    if (!window.confirm('Delete this deck from the feed?')) return
    try {
      const res = await fetch(`/api/feed/${deckId}`, { method: 'DELETE' })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to delete deck')
      }
      setDecks((prev) => prev.filter((d) => d.id !== deckId))
      setFolderDecks((prev) => prev.filter((d) => d.id !== deckId))
      addToast('Deck deleted', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete deck', 'error')
    }
  }

  const rawDecks = activeFolder ? folderDecks : decks
  const displayDecks = rawDecks.filter((deck) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      deck.title?.toLowerCase().includes(q) ||
      deck.subject?.toLowerCase().includes(q) ||
      deck.author_name?.toLowerCase().includes(q)
    )
  })

  return (
    <div id="tab-search" className="tab-pane flex-1 flex flex-col pb-6 relative z-10">
      {/* Purple Wavy Header Block (1:1 Reference) */}
      <div className="purple-wave-header pb-10 pt-3 px-5 relative overflow-hidden">
        <svg className="absolute inset-0 w-full h-full pointer-events-none -z-10" viewBox="0 0 356 200" preserveAspectRatio="none">
          <path d="M0,0 L356,0 L356,86 C285,106 235,38 140,24 C65,12 25,34 0,48 Z" fill="#0B0320" fillOpacity="0.48" />
        </svg>

        {/* Top Bar matching Ranks: Left Back to Library, Center Title ("Public Feed"), Right Bell */}
        <div className="h-10 flex items-center justify-between relative z-20 mb-2 text-white">
          <button
            type="button"
            onClick={() => {
              soundEngine.play('thocky')
              router.push('/')
            }}
            className="w-9 h-9 flex items-center justify-center text-white/90 hover:text-white active:scale-90 transition cursor-pointer"
            title="Back to Library"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <h2 className="text-[18px] font-extrabold text-white tracking-tight">Public Feed</h2>

          <button
            type="button"
            onClick={() => {
              soundEngine.play('thocky')
              openNotificationPanel()
            }}
            className="relative w-9 h-9 flex items-center justify-center text-white/90 hover:text-white active:scale-90 transition cursor-pointer"
            title="Download & Processing Queue"
          >
            <Bell className="w-5 h-5 text-white/90" />
            {hasActiveJobs && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-pulse ring-2 ring-[#0F0E17]" />
            )}
          </button>
        </div>

        <div className="relative z-20 pt-1 pb-3">
          {/* Search Input inside Purple Header (Official assets.html data-slot="input") */}
          <div className="relative mt-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8e92a8] pointer-events-none" />
            <input
              data-slot="input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search syllabi or subjects..."
              className="h-12 w-full pl-11 pr-10 py-1 rounded-[16px] border-2 border-[#222536] bg-[#1a1c29] text-white text-[14px] font-medium placeholder:text-[#8e92a8] focus:outline-none focus:border-[#9333ea] transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-[#8e92a8] hover:text-white"
                title="Clear"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Signature Wavy Fill Divider at Header Base */}
        <svg className="absolute -bottom-[2px] left-0 w-full h-[40px] pointer-events-none z-10 block overflow-visible" viewBox="0 0 356 40" fill="none" preserveAspectRatio="none">
          <path d="M0,16 C38,0 78,0 118,16 C158,32 198,32 238,16 C278,0 318,0 356,16 L356,42 L0,42 Z" fill="#DDD6FE" fillOpacity="0.32" />
          <path d="M0,21 C38,5 78,5 118,21 C158,37 198,37 238,21 C278,5 318,5 356,21 L356,42 L0,42 Z" fill="#0b0c14" />
        </svg>
      </div>

      {/* Content Below Wavy Divider with Seamless Connection */}
      <div className="relative z-20 -mt-[1px] pt-[1px] bg-gradient-to-b from-[#0b0c14] via-[#0b0c14]/40 to-transparent flex-1">
        <div className="px-4 pt-2.5 pb-4 space-y-3.5 relative z-10">
        {/* Folder Filter Row (Official assets.html 3D Maia Buttons) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1.5">
          <button
            data-slot="button"
            data-variant={activeFolder === null ? 'default' : 'secondary'}
            data-size="sm"
            onClick={() => {
              soundEngine.play('thocky')
              setActiveFolder(null)
            }}
            className={`h-9 px-3.5 rounded-[12px] border-2 font-extrabold text-xs uppercase tracking-wide tactile-btn flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeFolder === null
                ? 'border-[#9333ea] bg-[#9333ea] text-white shadow-[0px_3px_0px_0px_#6b21a8]'
                : 'border-[#222536] bg-[#1c1f2e] text-[#8e92a8] hover:text-white shadow-[0px_3px_0px_0px_#121420]'
            }`}
          >
            <BookOpen size={13} />
            <span>All</span>
          </button>

          {folders.map((f) => (
            <div key={f.id} className="relative group shrink-0">
              <button
                data-slot="button"
                data-variant={activeFolder === f.id ? 'default' : 'secondary'}
                data-size="sm"
                onClick={() => {
                  soundEngine.play('thocky')
                  setActiveFolder(f.id)
                }}
                className={`h-9 px-3.5 rounded-[12px] border-2 font-extrabold text-xs uppercase tracking-wide tactile-btn flex items-center gap-1.5 cursor-pointer ${
                  activeFolder === f.id
                    ? 'border-[#9333ea] bg-[#9333ea] text-white shadow-[0px_3px_0px_0px_#6b21a8]'
                    : 'border-[#222536] bg-[#1c1f2e] text-[#8e92a8] hover:text-white shadow-[0px_3px_0px_0px_#121420]'
                }`}
              >
                <FolderOpen size={13} />
                <span>{f.name}</span>
                <span className="text-[11px] opacity-70">({f.deck_count})</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => handleDeleteFolder(f.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete folder"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}

          {isAdmin && (
            <button
              data-slot="button"
              data-variant="outline"
              data-size="sm"
              onClick={() => {
                soundEngine.play('thocky')
                setShowNewFolder(true)
              }}
              className="h-9 px-3.5 rounded-[12px] border-2 border-[#222536] bg-[#0b0c14] text-[#a855f7] hover:bg-[#1a1c29] font-extrabold text-xs uppercase tracking-wide shadow-[0px_3px_0px_0px_#141622] tactile-btn flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Plus size={13} />
              <span>Folder</span>
            </button>
          )}
        </div>

        {showNewFolder && (
          <div className="flex items-center gap-2 p-2.5 bg-[#151722] rounded-[16px] border-2 border-[#222536]">
            <input
              data-slot="input"
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              maxLength={40}
              className="flex-1 h-10 px-3 py-1 rounded-[12px] border-2 border-[#222536] bg-[#1a1c29] text-white text-[13px] placeholder:text-[#8e92a8] focus:outline-none focus:border-[#9333ea]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder()
              }}
              autoFocus
            />
            <button
              data-slot="button"
              data-variant="default"
              data-size="sm"
              onClick={handleCreateFolder}
              disabled={creating || !newFolderName.trim()}
              className="h-10 px-4 rounded-[12px] border-2 border-[#9333ea] bg-[#9333ea] text-white font-extrabold text-xs uppercase tracking-wide shadow-[0px_3px_0px_0px_#6b21a8] tactile-btn disabled:opacity-50"
            >
              {creating ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
            </button>
            <button
              data-slot="button"
              data-variant="secondary"
              data-size="sm"
              onClick={() => {
                setShowNewFolder(false)
                setNewFolderName('')
              }}
              className="h-10 px-3.5 rounded-[12px] border-2 border-[#222536] bg-[#1c1f2e] text-[#8e92a8] font-extrabold text-xs uppercase tracking-wide shadow-[0px_3px_0px_0px_#121420] tactile-btn"
            >
              Cancel
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3.5" aria-label="Loading syllabi" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="syllabus-card animate-pulse pointer-events-none"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="h-6 w-24 bg-[#232738] rounded-full" />
                  <div className="h-7 w-16 bg-[#232738] rounded-[10px]" />
                </div>
                <div className="h-5 w-3/4 bg-[#232738] rounded-md mb-2.5" />
                <div className="h-4 w-1/2 bg-[#232738] rounded-md mb-4" />
                <div className="flex items-center justify-between pt-1">
                  <div className="h-4 w-28 bg-[#232738] rounded" />
                  <div className="h-8 w-24 bg-[#232738] rounded-[12px]" />
                </div>
                <div className="progress-stack mt-3">
                  <div className="progress-track-slate" />
                </div>
              </div>
            ))}
          </div>
        ) : displayDecks.length === 0 ? (
          <div className="py-12 px-4 text-center">
            {searchQuery ? (
              <div className="max-w-xs mx-auto space-y-3">
                <p className="text-[14px] font-semibold text-white">
                  No decks matching &ldquo;{searchQuery}&rdquo;
                </p>
                <p className="text-[12.5px] text-[#8e92a8] leading-relaxed">
                  Check your spelling or explore popular topics like Biology, History, or Computer Science.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A78BFA] hover:text-[#c084fc] pt-1"
                >
                  <span>Clear search</span>
                  <span>&rarr;</span>
                </button>
              </div>
            ) : activeFolder ? (
              <div className="max-w-xs mx-auto space-y-3">
                <p className="text-[14px] font-semibold text-white">This folder is empty</p>
                <p className="text-[12.5px] text-[#8e92a8] leading-relaxed">
                  Add decks from the public feed or create a new deck to organize here.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveFolder(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A78BFA] hover:text-[#c084fc] pt-1"
                >
                  <span>View all decks</span>
                  <span>&rarr;</span>
                </button>
              </div>
            ) : (
              <div className="max-w-xs mx-auto space-y-2">
                <p className="text-[14px] font-semibold text-white">No public decks available</p>
                <p className="text-[12.5px] text-[#8e92a8] leading-relaxed">
                  Be the first to publish a deck or check back later.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3.5">
            {displayDecks.map((deck, idx) => {
              const cleanAuthor = deck.author_name?.replace(/\[MERGED:.+?\]/, '').trim() || 'Peer'
              const isAdded = addedIds.has(deck.id)
              const fillPercent = Math.min(95, 40 + ((idx * 17 + (deck.download_count || 1) * 9) % 55))

              return (
                <article
                  key={deck.id}
                  className="syllabus-card relative"
                  onClick={() => {
                    if (isAdded && addedDeckIds[deck.id]) {
                      soundEngine.play('thocky')
                      router.push('/study/' + addedDeckIds[deck.id])
                    }
                  }}
                >
                  {/* Top Row: Time/Subject & Actions */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 text-[#64748B] text-[12px] font-medium min-w-0">
                      {(isAdmin || isMergeMode || selectedDeckIds.size > 0) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleSelectDeck(deck.id)
                          }}
                          className={`shrink-0 p-1 rounded ${
                            selectedDeckIds.has(deck.id) ? 'text-[#6226c9]' : 'text-[#64748B]'
                          }`}
                        >
                          {selectedDeckIds.has(deck.id) ? <CheckSquare size={15} /> : <Square size={15} />}
                        </button>
                      )}
                      <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                        <circle cx="12" cy="12" r="9" />
                        <polyline points="12 7 12 12 15 14" />
                      </svg>
                      <span className="truncate">{deck.subject || 'Study Set'}</span>
                    </div>

                    {/* Categorize / Merge / Admin controls - only visible to admin users */}
                    {isAdmin && (
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {activeFolder ? (
                          <button
                            data-slot="button"
                            data-variant="secondary"
                            data-size="xs"
                            onClick={() => handleRemoveFromFolder(deck.id)}
                            disabled={categorizingId === deck.id}
                            className="h-7 px-2.5 rounded-[10px] border-2 border-[#222536] bg-[#1c1f2e] text-[#94A3B8] hover:text-rose-400 font-extrabold text-[11px] uppercase tracking-wide shadow-[0px_2px_0px_0px_#121420] tactile-btn cursor-pointer"
                          >
                            Remove
                          </button>
                        ) : (
                          <div className="relative categorize-dropdown-container flex items-center gap-1.5">
                            {!isMergeMode && selectedDeckIds.size === 0 && (
                              <button
                                data-slot="button"
                                data-variant="secondary"
                                data-size="xs"
                                type="button"
                                onClick={() => {
                                  soundEngine.play('thocky')
                                  setIsMergeMode(true)
                                  setSelectedDeckIds(new Set([deck.id]))
                                  addToast(`Selected "${deck.title}". Tap 1 more deck to merge.`, 'info')
                                }}
                                className="h-7 px-2.5 rounded-[10px] border-2 border-[#222536] bg-[#1c1f2e] text-[#94A3B8] hover:text-[#c084fc] font-extrabold text-[11px] uppercase tracking-wide shadow-[0px_2px_0px_0px_#121420] tactile-btn flex items-center gap-1 cursor-pointer"
                                title="Merge"
                              >
                                <Layers size={11} />
                                <span>Merge</span>
                              </button>
                            )}

                            <button
                              data-slot="button"
                              data-variant="secondary"
                              data-size="xs"
                              type="button"
                              onClick={() => setOpenCategorizeDeckId((prev) => (prev === deck.id ? null : deck.id))}
                              className="h-7 px-2.5 rounded-[10px] border-2 border-[#222536] bg-[#1c1f2e] text-[#94A3B8] hover:text-[#c084fc] font-extrabold text-[11px] uppercase tracking-wide shadow-[0px_2px_0px_0px_#121420] tactile-btn flex items-center gap-1 cursor-pointer"
                              disabled={categorizingId === deck.id}
                            >
                              <Folder size={11} />
                              <ChevronDown size={10} />
                            </button>

                            {openCategorizeDeckId === deck.id && (() => {
                              const isMergedDeck = deck.author_name?.includes('[MERGED:')
                              let hoursLeft = 0
                              if (isMergedDeck) {
                                const match = deck.author_name.match(/\[MERGED:(.+?)\]/)
                                const mergedTime = match ? new Date(match[1]).getTime() : new Date(deck.published_at).getTime()
                                const elapsed = Date.now() - mergedTime
                                hoursLeft = Math.max(0, Math.ceil((24 * 60 * 60 * 1000 - elapsed) / (1000 * 60 * 60)))
                              }

                              return (
                                <div className="absolute right-0 top-full mt-1 z-30 w-48 bg-[#151722] text-white rounded-[16px] shadow-xl py-1.5 border border-[#222536]">
                                  {isMergedDeck && hoursLeft > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenCategorizeDeckId(null)
                                        setUnmergingConfirmDeck(deck)
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-[12px] font-bold text-[#A78BFA] hover:bg-white/5 flex items-center justify-between"
                                    >
                                      <span className="flex items-center gap-1.5">
                                        <Undo2 size={12} />
                                        <span>Unmerge</span>
                                      </span>
                                      <span className="text-[10px] opacity-75">{hoursLeft}h</span>
                                    </button>
                                  )}
                                  <div className="px-3 py-1 text-[10px] font-bold uppercase text-[#8e92a8]">Folder</div>
                                  {folders.length > 0 ? (
                                    folders.map((f) => (
                                      <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => {
                                          setOpenCategorizeDeckId(null)
                                          handleAddToFolder(f.id, deck.id)
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-white/5 flex items-center justify-between"
                                      >
                                        <span className="truncate">{f.name}</span>
                                        <span className="text-[11px] text-[#8e92a8]">({f.deck_count})</span>
                                      </button>
                                    ))
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenCategorizeDeckId(null)
                                        setShowNewFolder(true)
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-[12px] text-[#A78BFA] font-bold"
                                    >
                                      + New Folder
                                    </button>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        )}

                        <button
                          data-slot="button"
                          data-variant="secondary"
                          data-size="icon-xs"
                          onClick={() => handleDeleteDeck(deck.id)}
                          className="w-7 h-7 rounded-[10px] border-2 border-[#222536] bg-[#1c1f2e] text-[#8e92a8] hover:text-[#ef4444] hover:border-[#ef4444]/50 flex items-center justify-center shadow-[0px_2px_0px_0px_#121420] tactile-btn cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  {isAdmin && editingTitleId === deck.id ? (
                    <input
                      data-slot="input"
                      type="text"
                      className="w-full bg-[#1a1c29] border-2 border-[#222536] rounded-[12px] px-3 py-1 text-[15px] font-extrabold text-white mb-2 focus:outline-none focus:border-[#9333ea]"
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleRenameTitle(deck, editingTitle)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameTitle(deck, editingTitle)
                        if (e.key === 'Escape') setEditingTitleId(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <h3
                      className={`font-display text-[15px] font-extrabold text-[#0F172A] tracking-tight mb-2.5 break-words ${
                        savingTitleId === deck.id ? 'opacity-50' : ''
                      }`}
                      onDoubleClick={(e) => {
                        if (!isAdmin) return
                        e.stopPropagation()
                        setEditingTitleId(deck.id)
                        setEditingTitle(deck.title)
                      }}
                    >
                      {deck.title}
                    </h3>
                  )}

                  {/* Metrics + Action Pill Row */}
                  <div className="flex items-center justify-between text-[12.5px] text-[#64748B] gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span>
                        <strong className="font-bold text-[#0F172A]">{deck.download_count || 0}</strong> saves
                      </span>
                      <span>
                        by <strong className="font-bold text-[#0F172A]">{cleanAuthor}</strong>
                      </span>
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                      {isAdded ? (
                        <button
                          data-slot="button"
                          data-size="sm"
                          onClick={() => addedDeckIds[deck.id] && router.push('/study/' + addedDeckIds[deck.id])}
                          className="h-9 px-3.5 rounded-[12px] border-2 border-[#1ed760] bg-[#102e22] text-[#1ed760] font-extrabold text-xs uppercase tracking-wide shadow-[0px_3px_0px_0px_#0b1f17] tactile-btn flex items-center gap-1.5 cursor-pointer"
                        >
                          <BookOpen size={12} />
                          <span>Open</span>
                        </button>
                      ) : (
                        <button
                          data-slot="button"
                          data-variant="default"
                          data-size="sm"
                          onClick={() => handleAddToApp(deck)}
                          disabled={addingId === deck.id}
                          className="h-9 px-3.5 rounded-[12px] border-2 border-[#9333ea] bg-[#9333ea] text-white font-extrabold text-xs uppercase tracking-wide shadow-[0px_3px_0px_0px_#6b21a8] hover:opacity-95 tactile-btn flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          {addingId === deck.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                          <span>Get Deck</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dual-Layer Progress Stack (1:1 Reference) */}
                  <div className="progress-stack">
                    <div className="progress-fill-indigo" style={{ width: `${fillPercent}%` }} />
                    <div className="progress-track-slate" />
                  </div>
                </article>
              )
            })}
          </div>
        )}
        </div>
      </div>

      {/* Floating Merge Toolbar */}
      {(isMergeMode || selectedDeckIds.size > 0) && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-[#151722] border-2 border-[#9333ea] shadow-[0px_4px_0px_0px_#6b21a8] rounded-[16px] px-4 py-2.5 flex items-center gap-3 text-[13px] text-white">
            <span className="font-bold flex items-center gap-1.5">
              <Layers className="text-[#c084fc]" size={16} />
              <span>{selectedDeckIds.size}/2 selected</span>
            </span>
            <button
              data-slot="button"
              data-variant="default"
              data-size="sm"
              onClick={() => setShowMergePrompt(true)}
              disabled={selectedDeckIds.size !== 2}
              className="h-8 px-3 rounded-[10px] border-2 border-[#9333ea] bg-[#9333ea] text-white font-extrabold text-xs uppercase tracking-wide shadow-[0px_2px_0px_0px_#6b21a8] tactile-btn disabled:opacity-40"
            >
              Merge
            </button>
            <button
              onClick={() => {
                setSelectedDeckIds(new Set())
                setIsMergeMode(false)
              }}
              className="p-1 text-[#8e92a8] hover:text-white"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Merge Confirmation Modal */}
      {showMergePrompt && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#151722] rounded-2xl border-2 border-[#222536] shadow-[0px_6px_0px_0px_#141622] p-6 max-w-sm w-full">
            <h3 className="text-[18px] font-extrabold text-white mb-1">Merge 2 Decks</h3>
            <p className="text-[13px] text-[#8e92a8] mb-4">
              Undo within 24h
            </p>
            <input
              data-slot="input"
              type="text"
              value={customMergeTitle}
              onChange={(e) => setCustomMergeTitle(e.target.value)}
              placeholder="Merged title (optional)"
              className="h-12 w-full px-4 py-1 rounded-[16px] bg-[#1a1c29] border-2 border-[#222536] text-white text-[14px] placeholder:text-[#8e92a8] focus:outline-none focus:border-[#9333ea] mb-4"
            />
            <div className="flex flex-col gap-2 pt-1">
              <button
                data-slot="button"
                data-variant="default"
                type="button"
                onClick={handleMergeDecks}
                disabled={isMergingDecks}
                className="w-full h-11 rounded-[14px] border-2 border-[#9333ea] bg-[#9333ea] text-white font-extrabold text-[13.5px] uppercase tracking-wide shadow-[0px_4px_0px_0px_#6b21a8] tactile-btn flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isMergingDecks && <Loader2 size={14} className="animate-spin" />}
                <span>Confirm Merge</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMergePrompt(false)}
                disabled={isMergingDecks}
                className="w-full py-2 text-[13px] font-extrabold text-[#8e92a8] hover:text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <span>&larr;</span>
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unmerge Confirmation Modal */}
      {unmergingConfirmDeck && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#151722] rounded-2xl border-2 border-[#222536] shadow-[0px_6px_0px_0px_#141622] p-6 max-w-sm w-full">
            <h3 className="text-[18px] font-extrabold text-white mb-1">Unmerge Deck?</h3>
            <p className="text-[13px] text-[#8e92a8] mb-5">
              Restore original decks for &ldquo;{unmergingConfirmDeck.title}&rdquo;.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                data-slot="button"
                data-variant="default"
                type="button"
                onClick={async () => {
                  const id = unmergingConfirmDeck.id
                  setUnmergingConfirmDeck(null)
                  await handleUnmergeDeck(id)
                }}
                className="w-full h-11 rounded-[14px] border-2 border-[#9333ea] bg-[#9333ea] text-white font-extrabold text-[13.5px] uppercase tracking-wide shadow-[0px_4px_0px_0px_#6b21a8] tactile-btn cursor-pointer"
              >
                Unmerge
              </button>
              <button
                type="button"
                onClick={() => setUnmergingConfirmDeck(null)}
                className="w-full py-2 text-[13px] font-extrabold text-[#8e92a8] hover:text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <span>&larr;</span>
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
