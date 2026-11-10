'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search as SearchIcon, X } from 'lucide-react'
import { getAllDecks } from '@/db/deckRepository'
import { getCardsByDeck } from '@/db/cardRepository'
import Fuse, { type FuseResult } from 'fuse.js'
import { buildSearchIndex, searchCards } from '@/features/search/searchIndex'
import SearchResult from '@/features/search/SearchResult'
import type { Card } from '@/lib/zodSchemas'
import { SEARCH_MIN_CHARS, SEARCH_MAX_RESULTS } from '@/lib/constants'
import { soundEngine } from '@/utils/soundEngine'

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FuseResult<Card>[]>([])
  const [deckMap, setDeckMap] = useState<Record<string, string>>({})
  const [filterDeckId, setFilterDeckId] = useState<string>('all')
  const fuseRef = useRef<Fuse<Card> | null>(null)

  useEffect(() => {
    const build = async () => {
      const decks = await getAllDecks()
      const map: Record<string, string> = {}
      const allCards: Card[] = []

      for (const deck of decks) {
        map[deck.id] = deck.title
        const cards = await getCardsByDeck(deck.id)
        allCards.push(...cards)
      }

      setDeckMap(map)
      fuseRef.current = buildSearchIndex(allCards)
    }
    build()
  }, [])

  useEffect(() => {
    if (!fuseRef.current) return
    if (query.length >= SEARCH_MIN_CHARS) {
      setResults(searchCards(fuseRef.current, query).slice(0, SEARCH_MAX_RESULTS))
    } else {
      setResults([])
    }
  }, [query])

  const filteredResults =
    filterDeckId !== 'all' ? results.filter((r) => r.item.deckId === filterDeckId) : results

  return (
    <div className="flex-1 flex flex-col pb-4 relative z-10">
      {/* Purple Wavy Header */}
      <div className="purple-wave-header pb-10 pt-3 px-5 relative overflow-hidden">
        <svg className="absolute inset-0 w-full h-full pointer-events-none -z-10" viewBox="0 0 356 200" preserveAspectRatio="none">
          <path d="M0,0 L356,0 L356,86 C285,106 235,38 140,24 C65,12 25,34 0,48 Z" fill="#0B0320" fillOpacity="0.48" />
        </svg>

        <div className="h-10 flex items-center justify-between relative z-20 mb-2 text-white">
          <button
            onClick={() => {
              soundEngine.play('thocky')
              router.back()
            }}
            className="w-8 h-8 flex items-center justify-center text-white active:scale-90 transition cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <span className="text-[13px] font-extrabold text-white tracking-widest uppercase">SEARCH</span>

          <div className="w-8" />
        </div>

        <div className="relative z-20 pt-1 pb-2">
          <h1 className="font-display text-white text-[23px] font-extrabold tracking-tight leading-tight mb-2.5">
            Search Cards
          </h1>

          <div className="relative">
            <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search flashcards..."
              autoFocus
              className="w-full pl-10 pr-9 py-2.5 rounded-full bg-white text-[#0F172A] text-[13.5px] font-medium placeholder:text-[#64748B] focus:outline-none shadow-md"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A]"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <svg className="absolute -bottom-[2px] left-0 w-full h-[40px] pointer-events-none z-10 block overflow-visible" viewBox="0 0 356 40" fill="none" preserveAspectRatio="none">
          <path d="M0,16 C38,0 78,0 118,16 C158,32 198,32 238,16 C278,0 318,0 356,16 L356,42 L0,42 Z" fill="#DDD6FE" fillOpacity="0.32" />
          <path className="wave-bottom-blend" d="M0,21 C38,5 78,5 118,21 C158,37 198,37 238,21 C278,5 318,5 356,21 L356,42 L0,42 Z" fill="#0b0c14" />
        </svg>
      </div>

      <div className="relative z-20 -mt-[1px] pt-[1px] bg-gradient-to-b from-[#0b0c14] via-[#0b0c14] to-transparent flex-1">
        <div className="px-4 pt-3">
        {Object.keys(deckMap).length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button
              onClick={() => setFilterDeckId('all')}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold whitespace-nowrap transition ${
                filterDeckId === 'all'
                  ? 'bg-[#6226c9] text-white'
                  : 'bg-[#151722] text-[#8e92a8] hover:text-white'
              }`}
            >
              All decks
            </button>
            {Object.entries(deckMap).map(([id, title]) => (
              <button
                key={id}
                onClick={() => setFilterDeckId(id)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold whitespace-nowrap transition ${
                  filterDeckId === id
                    ? 'bg-[#6226c9] text-white'
                    : 'bg-[#151722] text-[#8e92a8] hover:text-white'
                }`}
              >
                {title}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3">
          {query.length < SEARCH_MIN_CHARS ? (
            <div className="text-center py-12 text-[#8e92a8] text-[13.5px] font-medium">
              Type to search across your decks
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="text-center py-12 text-[#8e92a8] text-[13.5px] font-medium">
              No results for &lsquo;{query}&rsquo;
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredResults.map((r, i) => (
                <SearchResult
                  key={r.item.id + '-' + i}
                  result={r}
                  deckTitle={deckMap[r.item.deckId] ?? ''}
                  onClick={() => router.push('/study/' + r.item.deckId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  )
}
