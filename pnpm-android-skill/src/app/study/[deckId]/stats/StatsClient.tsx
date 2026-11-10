'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getDeck } from '@/db/deckRepository'
import { useStudyStats } from '@/hooks/useStudyStats'
import StudyHeader from '@/components/StudyHeader'
import SubjectStatsCard from '@/features/stats/SubjectStatsCard'
import CardMasteryList from '@/features/stats/CardMasteryList'
import ExportButton from '@/features/export/ExportButton'
import type { Deck } from '@/lib/zodSchemas'

export default function StatsClient() {
  const params = useParams()
  const router = useRouter()
  const rawDeckId = params?.deckId as string
  const deckId = (rawDeckId && rawDeckId !== '_offline')
    ? rawDeckId
    : (typeof window !== 'undefined' ? window.location.pathname.split('/study/')[1]?.split('/')[0]?.split('?')[0] || '' : '')

  const { stats, cards, masteredCount, learningCount, newCount } = useStudyStats(deckId)
  const [deck, setDeck] = useState<Deck | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDeck(deckId).then((d) => {
      setDeck(d ?? null)
      setLoading(false)
    })
  }, [deckId])

  const dailyCounts = stats?.dailyCounts ?? {}
  const today = new Date()

  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const count = dailyCounts[key] ?? 0
    const dayName = d.toLocaleDateString('en', { weekday: 'short' })
    return { key, count, dayName }
  }).reverse()

  const maxCount = Math.max(...last7Days.map((d) => d.count), 1)

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#0b0c14] text-white">
        <div className="max-w-xl mx-auto px-4 pt-2">
          <StudyHeader
            title="Progress"
            closeIcon="back"
            onClose={() => router.push('/study/' + deckId)}
          />
          <div className="p-4 space-y-4 animate-pulse mt-2">
            <div className="h-44 bg-[#151722] rounded-[20px] border-2 border-[#222536]" />
            <div className="h-32 bg-[#151722] rounded-[20px] border-2 border-[#222536]" />
          </div>
        </div>
      </div>
    )
  }

  if (!deck || !stats) {
    return (
      <div className="min-h-[100dvh] bg-[#0b0c14] flex flex-col items-center justify-center p-4 text-center">
        <p className="text-[#8e92a8] text-[15px] font-semibold mb-4">Stats not available</p>
        <button
          onClick={() => router.push('/study/' + deckId)}
          className="h-12 px-6 rounded-[14px] bg-[#7e57ff] border-2 border-[#9d7eff] shadow-[0px_3px_0px_0px_#4c2fb3] text-white font-extrabold text-[14px] tactile-btn cursor-pointer"
        >
          Back to deck
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-[#0b0c14] text-white">
      <div className="max-w-xl mx-auto px-4 pt-2">
        <StudyHeader
          title="Progress"
          closeIcon="back"
          onClose={() => router.push('/study/' + deckId)}
          rightSlot={<ExportButton deckId={deckId} deckTitle={deck?.title ?? ''} variant="icon" />}
        />

        <div className="py-4 flex flex-col gap-6">
          <SubjectStatsCard
            stats={stats}
            deckTitle={deck.title}
            masteredCount={masteredCount}
            learningCount={learningCount}
            newCount={newCount}
          />

          <CardMasteryList cards={cards} deckId={deckId} />

          <div className="py-2">
            <h3 className="text-[14px] font-extrabold text-white tracking-tight mb-3">Study history</h3>
            <div className="flex items-end gap-2 h-20 px-2">
              {last7Days.map((d) => (
                <div key={d.key} className="flex-1 flex flex-col items-center h-full justify-end">
                  <div
                    className="w-full rounded-t-md bg-[#7e57ff] transition-all"
                    style={{
                      height: `${Math.max((d.count / maxCount) * 64, 4)}px`,
                      opacity: d.count > 0 ? 0.95 : 0.35,
                    }}
                  />
                  <span className="text-[11px] font-semibold text-[#8e92a8] mt-1.5">{d.dayName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
