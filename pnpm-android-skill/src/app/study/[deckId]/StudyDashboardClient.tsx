'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Plus,
  Share2,
} from 'lucide-react'
import { getDeck, updateDeck, deleteDeck, createDeck } from '@/db/deckRepository'
import { getCardsByDeck, createCards } from '@/db/cardRepository'
import { getImagesByDeck } from '@/db/imageRepository'
import { useStudyStats } from '@/hooks/useStudyStats'
import { useStatsStore } from '@/store/statsStore'
import { useToastStore } from '@/store/toastStore'
import { createBrowserSupabase } from '@/lib/supabase'
import { parseCSVFile } from '@/features/upload/csvParser'
import { auditAndFixCSV } from '@/features/upload/csvFixer'
import ModeCard from '@/components/ModeCard'
import ExportButton from '@/features/export/ExportButton'
import FlashcardCreator from '@/features/flashcards/FlashcardCreator'
import type { Deck } from '@/lib/zodSchemas'
import { safeNavigate } from '@/lib/offlineNavigation'
import { soundEngine } from '@/utils/soundEngine'

export default function StudyDashboard() {
  const params = useParams()
  const router = useRouter()
  const addToast = useToastStore((s) => s.addToast)
  const initStats = useStatsStore((s) => s.initStats)

  const rawDeckId = params?.deckId as string
  const deckId =
    rawDeckId && rawDeckId !== '_offline'
      ? rawDeckId
      : typeof window !== 'undefined'
        ? window.location.pathname.split('/study/')[1]?.split('/')[0]?.split('?')[0] || ''
        : ''

  const [deck, setDeck] = useState<Deck | null>(null)
  const [deckLoading, setDeckLoading] = useState(true)
  const [imageCount, setImageCount] = useState(0)
  const {
    stats,
    masteredCount,
    learningCount,
    newCount,
    masteredPercent,
    accuracy,
    dueCount,
    loading,
  } = useStudyStats(deckId)

  const reloadDeck = async () => {
    if (!deckId) {
      setDeckLoading(false)
      return
    }
    if (typeof window !== 'undefined' && deckId !== '_offline') {
      try {
        localStorage.setItem('studyup_active_deck_id', deckId)
      } catch {}
    }
    let [d, imgs] = await Promise.all([getDeck(deckId), getImagesByDeck(deckId)])
    if (!d) {
      await new Promise((r) => setTimeout(r, 400))
      ;[d, imgs] = await Promise.all([getDeck(deckId), getImagesByDeck(deckId)])
    }
    if (!d) {
      router.replace('/')
      addToast('Deck not found', 'error')
      setDeck(null)
      setDeckLoading(false)
      return
    }
    setDeck(d)
    setImageCount(imgs.length)
    initStats(deckId, d.cards.length)
    setDeckLoading(false)
  }

  useEffect(() => {
    reloadDeck()
  }, [deckId, router, addToast, initStats])

  const [showCreator, setShowCreator] = useState(false)
  const [showRepublish, setShowRepublish] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [canPublish, setCanPublish] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')

  useEffect(() => {
    const supabase = createBrowserSupabase()
    supabase.auth.getSession().then(async ({ data }: { data: { session: any } }) => {
      if (!data.session) return
      const res = await fetch('/api/session')
      const sessionData = await res.json().catch(() => null)
      setCanPublish(sessionData?.canPublish ?? true)
    })
  }, [])

  const handleSaveTitle = async () => {
    const trimmed = editTitle.trim()
    if (!trimmed || !deck) return
    await updateDeck(deckId, { title: trimmed })
    setDeck({ ...deck, title: trimmed })
    setEditingTitle(false)
  }

  const buildDeckCsv = async () => {
    const cards = await getCardsByDeck(deckId)
    const hasCards = cards.length > 0
    const hasQuizItems = (deck?.quizItems?.length ?? 0) > 0
    if (!hasCards && !hasQuizItems) {
      throw new Error('Cannot publish an empty deck')
    }

    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }

    const csvHeaders =
      'front,back,chapter,subject,lesson,type,mc_correct,mc_distractor1,mc_distractor2,mc_distractor3,tf_answer,explanation,enum_items,id_answer,id_variants'
    const csvRows: string[] = []

    for (const c of cards) {
      csvRows.push(
        [
          esc(c.front),
          esc(c.back),
          esc(c.chapter),
          esc(c.subject || deck?.subject),
          esc(c.lesson),
          esc(c.type),
          esc(c.mc_correct),
          esc(c.mc_distractor1),
          esc(c.mc_distractor2),
          esc(c.mc_distractor3),
          esc(c.tf_answer),
          '',
          esc(c.enum_items),
          esc(c.id_answer),
          esc(c.id_variants),
        ].join(',')
      )
    }

    return [csvHeaders, ...csvRows].join('\n')
  }

  const handlePublish = async (mode: 'overwrite' | 'append') => {
    if (!deck) return
    setPublishing(true)
    try {
      const csvContent = await buildDeckCsv()

      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: deck.title,
          subject: deck.subject,
          csvContent,
          mode,
        }),
      })

      const resData = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(resData.error || 'Unable to update deck on Public Feed. Please check your connection and try again.')
      }

      if (resData.appended || resData.updated) {
        addToast('Deck updated on Public Feed!', 'success')
        const feedRes = await fetch(`/api/feed/${resData.id}`)
        if (feedRes.ok) {
          const feedData = await feedRes.json()
          const parsed = parseCSVFile(auditAndFixCSV(feedData.csv_content), feedData.title)
          const newDeckId = await createDeck(parsed.deck)
          const cardsWithDeckId = parsed.cards.map((c) => ({ ...c, deckId: newDeckId }))
          await createCards(cardsWithDeckId)
          await deleteDeck(deckId)
          router.push('/study/' + newDeckId)
        }
      } else {
        addToast('Published to Public Feed!', 'success')
      }
      setShowRepublish(false)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to publish', 'error')
    } finally {
      setPublishing(false)
    }
  }

  const startPublish = async () => {
    if (!deck) return
    soundEngine.play('thocky')
    setPublishing(true)
    try {
      const res = await fetch(`/api/publish?title=${encodeURIComponent(deck.title ?? 'Deck')}`)
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.existing) {
        if (data.ownedByOther) {
          addToast(
            `"${deck.title}" was published by ${data.authorName || 'another author'}. Rename your deck to publish.`,
            'error'
          )
          setPublishing(false)
          return
        }
        setShowRepublish(true)
        setPublishing(false)
        return
      }
      await handlePublish('overwrite')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to publish', 'error')
      setPublishing(false)
    }
  }

  if (deckLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0b0c14] flex flex-col">
        <div className="h-[220px] purple-wave-header animate-pulse" />
        <div className="px-4 pt-6 space-y-4">
          <div className="h-8 w-48 bg-[#151722] rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 bg-[#151722] rounded-[20px] animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const mcCount = deck?.quizItems.filter((q) => q.mode === 'multiple_choice').length ?? 0
  const tfCount = deck?.quizItems.filter((q) => q.mode === 'true_false').length ?? 0
  const enumCount = deck?.quizItems.filter((q) => q.mode === 'enumeration').length ?? 0
  const keywordCount = deck?.cards.filter((c) => c.type === 'keyword').length ?? 0
  const flashcardCount =
    deck?.cards.filter((c) => {
      const t = (c.type as string).toLowerCase()
      return t !== 'keyword' && t !== 'tf' && t !== 'true_false'
    }).length ?? 0

  const hasMath =
    deck?.cards.some((c) => {
      const t = (c.type as string).toLowerCase()
      return t === 'math' || t === 'math_problem' || c.front.includes('&*(') || c.back.includes('&*(')
    }) || false

  const hasCode =
    deck?.cards.some((c) => {
      const t = (c.type as string).toLowerCase()
      return (
        t === 'code' ||
        t === 'code_challenge' ||
        c.front.includes('&[CODE:') ||
        c.back.includes('&[CODE:')
      )
    }) || false

  const mathCount =
    deck?.cards.filter((c) => {
      const t = (c.type as string).toLowerCase()
      return t === 'math' || t === 'math_problem' || c.front.includes('&*(') || c.back.includes('&*(')
    }).length ?? 0

  const codeCount =
    deck?.cards.filter((c) => {
      const t = (c.type as string).toLowerCase()
      return (
        t === 'code' ||
        t === 'code_challenge' ||
        c.front.includes('&[CODE:') ||
        c.back.includes('&[CODE:')
      )
    }).length ?? 0

  return (
    <div className="flex-1 flex flex-col pb-8 relative z-10">
      {/* Purple Wavy Header Block (Same position as Public Feed) */}
      <div className="purple-wave-header pb-10 pt-3 px-5 relative overflow-hidden">
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none -z-10"
          viewBox="0 0 356 200"
          preserveAspectRatio="none"
        >
          <path
            d="M0,0 L356,0 L356,86 C285,106 235,38 140,24 C65,12 25,34 0,48 Z"
            fill="#0B0320"
            fillOpacity="0.48"
          />
        </svg>

        {/* Topbar Row: Back / STUDYUP / Export (Bare top buttons - no card divs) */}
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
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <span className="text-[13px] font-extrabold text-white tracking-widest uppercase">STUDYUP</span>

          <div className="flex items-center">
            <ExportButton deckId={deckId} deckTitle={deck?.title ?? 'Deck'} variant="icon" />
          </div>
        </div>

        {/* Deck Title + Raw Fire Streak */}
        <div className="relative z-20 pt-1 pb-2 pr-24">
          {editingTitle ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle()
                if (e.key === 'Escape') setEditingTitle(false)
              }}
              onBlur={handleSaveTitle}
              autoFocus
              className="font-display text-[22px] font-extrabold text-white bg-[#0b0c14] border border-[#222536] rounded-xl px-3 py-1 w-full focus:outline-none"
            />
          ) : (
            <h1
              className="font-display text-[23px] font-extrabold text-white tracking-tight leading-tight mb-1 cursor-pointer break-words"
              onClick={() => {
                setEditTitle(deck?.title ?? '')
                setEditingTitle(true)
              }}
              title="Tap to rename"
            >
              {deck?.title ?? 'Deck'}
            </h1>
          )}

          {/* Raw Unboxed Fire Streak */}
          <div className="relative flex items-center justify-start w-fit select-none">
            <img
              src="/assets/images/fire-transparent.gif"
              alt="Fire Streak"
              className="object-contain drop-shadow-[0_2px_14px_rgba(249,115,22,0.55)]"
              style={{ width: '40px', height: '40px' }}
            />
            <span className="absolute inset-0 flex items-center justify-center pt-2 translate-y-[2px] text-[11.5px] font-black text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.85)] tracking-tighter">
              {stats?.studyStreak ?? 0}
            </span>
          </div>
          <span className="text-[12px] font-black text-[#FB923C] tracking-wide block">
            {deck?.subject || 'Study Set'}
          </span>
        </div>

        {/* Mascot Peeking over the wave line */}
        <div
          onClick={() => {
            soundEngine.play('poppy')
            safeNavigate(router, `/study/${deck?.id || deckId}/flashcards`)
          }}
          className="absolute right-2 -bottom-[28px] w-[165px] h-[165px] z-0 cursor-pointer active:scale-95 transition"
          title="Start Flashcards"
        >
          <img
            src="/assets/images/mascot_with_hat.png"
            alt="StudyUp Mascot"
            className="w-full h-full object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.6)] mascot-float-idle"
          />
        </div>

        {/* Wavy Fill Divider */}
        <svg
          className="absolute -bottom-[2px] left-0 w-full h-[40px] pointer-events-none z-10 block overflow-visible"
          viewBox="0 0 356 40"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M0,16 C38,0 78,0 118,16 C158,32 198,32 238,16 C278,0 318,0 356,16 L356,42 L0,42 Z"
            fill="#DDD6FE"
            fillOpacity="0.32"
          />
          <path
            className="wave-bottom-blend"
            d="M0,21 C38,5 78,5 118,21 C158,37 198,37 238,21 C278,5 318,5 356,21 L356,42 L0,42 Z"
            fill="#0b0c14"
          />
        </svg>
      </div>

      {/* Below Wave: Seamless connecting background wrapper */}
      <div className="relative z-20 -mt-[1px] pt-[1px] bg-gradient-to-b from-[#0b0c14] via-[#0b0c14] to-transparent flex-1">
        <div className="px-4 pt-3 space-y-4 relative z-10">
        <div className="px-1">
          <div className="flex items-center justify-between text-[12.5px] font-semibold text-white/80 mb-2">
            <span>
              {dueCount > 0 ? `${dueCount} cards due` : `${flashcardCount} cards`} · {masteredCount} mastered · {learningCount} learning · {newCount} new
            </span>
            <span className="text-[#C4B5FD] font-bold">{masteredPercent}%</span>
          </div>

          <div className="w-full h-1.5 rounded-full bg-[#1c1e2a] overflow-hidden mb-3.5">
            <div
              className="h-full rounded-full bg-[#7C3AED] transition-all duration-300"
              style={{ width: `${Math.max(4, masteredPercent)}%` }}
            />
          </div>

          <button
            data-slot="button"
            data-variant="default"
            data-size="default"
            onClick={() => {
              soundEngine.play('poppy')
              safeNavigate(router, `/study/${deck?.id || deckId}/flashcards`)
            }}
            className="w-full h-12 px-5 rounded-[16px] border-2 border-[#9333ea] bg-[#9333ea] text-white font-extrabold text-[15px] uppercase tracking-wide shadow-[0px_4px_0px_0px_#6b21a8] hover:opacity-95 tactile-btn flex items-center justify-center gap-2 cursor-pointer"
          >
            Start review
          </button>

          {/* Secondary Actions: Edit Cards + Publish (Bolded clickable text, no fill or outline, animated underline) */}
          <div className="flex items-center justify-center gap-7 mt-3.5 py-1">
            <button
              type="button"
              onClick={() => {
                soundEngine.play('thocky')
                setShowCreator(true)
              }}
              className="group relative inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-white/90 hover:text-white transition cursor-pointer"
            >
              <Plus size={15} className="text-[#c084fc]" />
              <span className="relative after:content-[''] after:absolute after:-bottom-0.5 after:left-0 after:w-0 after:h-[2px] after:bg-[#c084fc] group-hover:after:w-full after:transition-all after:duration-300">
                Edit Cards
              </span>
            </button>

            {canPublish && (
              <button
                type="button"
                onClick={startPublish}
                disabled={publishing}
                className="group relative inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-white/90 hover:text-white transition disabled:opacity-50 cursor-pointer"
              >
                <Share2 size={14} className="text-[#c084fc]" />
                <span className="relative after:content-[''] after:absolute after:-bottom-0.5 after:left-0 after:w-0 after:h-[2px] after:bg-[#c084fc] group-hover:after:w-full after:transition-all after:duration-300">
                  {publishing ? 'Publishing...' : 'Publish'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Study Modes Section */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[14px] font-extrabold text-white tracking-tight">Study Modes</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ModeCard
              mode="flashcards"
              label="Flashcards"
              description="3D active recall"
              href={`/study/${deckId}/flashcards`}
              count={`${flashcardCount}`}
              disabled={flashcardCount === 0}
            />
            <ModeCard
              mode="multiple-choice"
              label="Multiple Choice"
              description="4-option quiz"
              href={`/study/${deckId}/quiz/multiple-choice`}
              count={`${mcCount}`}
              disabled={mcCount === 0}
            />
            <ModeCard
              mode="true-false"
              label="True / False"
              description="Rapid verification"
              href={`/study/${deckId}/quiz/true-false`}
              count={`${tfCount}`}
              disabled={tfCount === 0}
            />
            <ModeCard
              mode="enumeration"
              label="Enumeration"
              description="Recall full lists"
              href={`/study/${deckId}/quiz/enumeration`}
              count={`${enumCount}`}
              disabled={enumCount === 0}
            />
            <ModeCard
              mode="blanks"
              label="Fill in Blanks"
              description="Interactive reading"
              href={`/study/${deckId}/blanks`}
              count="Docs"
            />
            <ModeCard
              mode="notes"
              label="Notes"
              description="Key terms & tables"
              href={`/study/${deckId}/notes`}
              count={`${keywordCount}`}
              disabled={keywordCount === 0}
            />
            <ModeCard
              mode="gallery"
              label="Gallery"
              description="Visual diagrams"
              href={`/study/${deckId}/images`}
              count={`${imageCount}`}
            />
            <ModeCard
              mode="math"
              label="Math Lab"
              description="Step-by-step solver"
              href={`/study/${deckId}/math`}
              count={`${mathCount}`}
              disabled={!hasMath}
            />
            <ModeCard
              mode="code"
              label="Code Lab"
              description="Interactive runner"
              href={`/study/${deckId}/code`}
              count={`${codeCount}`}
              disabled={!hasCode}
            />
            <ModeCard
              mode="stats"
              label="Stats"
              description="Accuracy & history"
              href={`/study/${deckId}/stats`}
              count={`${accuracy}%`}
            />
          </div>
        </div>
      </div>
    </div>

      {showCreator && (
        <FlashcardCreator
          deckId={deckId}
          deck={deck}
          onClose={() => setShowCreator(false)}
          onCardsAdded={reloadDeck}
        />
      )}

      {showRepublish && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          onClick={() => !publishing && setShowRepublish(false)}
        >
          <div
            className="bg-[#151722] rounded-2xl border-2 border-[#222536] shadow-[0px_6px_0px_0px_#141622] w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-[18px] font-extrabold text-white mb-1.5">Republish Deck</h2>
            <p className="text-[13px] text-[#8e92a8] mb-5">
              This title is already in the feed. Overwrite current cards or add new cards on top?
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                data-slot="button"
                data-variant="default"
                onClick={() => handlePublish('overwrite')}
                disabled={publishing}
                className="w-full h-11 px-5 rounded-[14px] border-2 border-[#9333ea] bg-[#9333ea] text-white font-extrabold text-[13.5px] uppercase tracking-wide shadow-[0px_4px_0px_0px_#6b21a8] tactile-btn disabled:opacity-50"
              >
                {publishing ? 'Publishing...' : 'Overwrite current cards'}
              </button>
              <button
                data-slot="button"
                data-variant="secondary"
                onClick={() => handlePublish('append')}
                disabled={publishing}
                className="w-full h-11 px-5 rounded-[14px] border-2 border-[#222536] bg-[#1c1f2e] text-white font-extrabold text-[13.5px] uppercase tracking-wide shadow-[0px_4px_0px_0px_#121420] tactile-btn disabled:opacity-50"
              >
                Add cards on top
              </button>
              <button
                onClick={() => setShowRepublish(false)}
                disabled={publishing}
                className="text-[13px] font-bold uppercase tracking-wide text-[#8e92a8] hover:text-white py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
