'use client'

import AnimatedFlameStreak from '@/components/AnimatedFlameStreak'
import type { DeckStats } from '@/lib/zodSchemas'

interface SubjectStatsCardProps {
  stats: DeckStats
  deckTitle: string
  masteredCount: number
  learningCount: number
  newCount: number
}

export default function SubjectStatsCard({
  stats,
  deckTitle,
  masteredCount,
  learningCount,
  newCount,
}: SubjectStatsCardProps) {
  const total = stats.totalCards

  return (
    <div className="space-y-3">
      {/* Deck Title Header on surface */}
      <div>
        <h2 className="font-display text-[22px] font-extrabold text-white tracking-tight leading-tight break-words">
          {deckTitle}
        </h2>
        <div className="flex items-center gap-4 text-[12.5px] font-semibold mt-1 text-[#8e92a8]">
          <span>Flashcards: <strong className="text-white">{total}</strong></span>
          <span>Correct: <strong className="text-[#1ed760]">{stats.correct}</strong></span>
          <span>Wrong: <strong className="text-[#ff5252]">{stats.wrong}</strong></span>
        </div>
      </div>

      {/* Progress Stack on surface */}
      <div className="w-full h-2 rounded-full overflow-hidden bg-[#1c1e2a] flex mt-2">
        {total > 0 && (
          <>
            <div
              className="h-full bg-[#1ed760] transition-all"
              style={{ width: `${(masteredCount / total) * 100}%` }}
            />
            <div
              className="h-full bg-[#f59e0b] transition-all"
              style={{ width: `${(learningCount / total) * 100}%` }}
            />
          </>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs font-bold">
        <span className="text-[#1ed760] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#1ed760]" /> Mastered {masteredCount}
        </span>
        <span className="text-[#f59e0b] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> Learning {learningCount}
        </span>
        <span className="text-[#a78bfa] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#a78bfa]" /> New {newCount}
        </span>
      </div>

      {/* Unboxed Surface Metrics (No card divs) */}
      <div className="pt-4 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8e92a8] block">Accuracy</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-display text-[34px] font-extrabold text-white leading-none">
                {stats.accuracy}
              </span>
              <span className="text-[15px] font-extrabold text-[#c084fc]">%</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8e92a8] block">Streak</span>
            <div className="flex items-center justify-end gap-2 mt-1">
              <AnimatedFlameStreak streak={stats.studyStreak} size="sm" showLabel={true} />
            </div>
            {stats.lastStudied && (
              <span className="text-[11px] text-[#6e7285] mt-1 block">
                Studied {new Date(stats.lastStudied).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-[#222536] flex items-center justify-between text-left">
          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#8e92a8] block">Multiple Choice</span>
            <span className="font-display text-[17px] font-extrabold text-white mt-0.5 block">{stats.mcScore}%</span>
          </div>
          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#8e92a8] block">Identification</span>
            <span className="font-display text-[17px] font-extrabold text-white mt-0.5 block">{stats.identificationCorrect}</span>
          </div>
          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#8e92a8] block">Enumeration</span>
            <span className="font-display text-[17px] font-extrabold text-white mt-0.5 block">{stats.enumerationCompleted}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
