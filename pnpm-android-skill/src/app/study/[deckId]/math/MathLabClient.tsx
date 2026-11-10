'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import MathLabView from '@/features/math/MathLabView'
import { getDeck } from '@/db/deckRepository'
import type { Deck } from '@/lib/zodSchemas'

export default function MathLabClient() {
  const params = useParams()
  const router = useRouter()
  const rawDeckId = params?.deckId as string
  const deckId = (rawDeckId && rawDeckId !== '_offline')
    ? rawDeckId
    : (typeof window !== 'undefined' ? window.location.pathname.split('/study/')[1]?.split('/')[0]?.split('?')[0] || '' : '')

  const [deck, setDeck] = useState<Deck | null>(null)
  
  useEffect(() => {
    if (deckId) {
      getDeck(deckId).then((d) => setDeck(d || null))
    }
  }, [deckId])

  return (
    <MathLabView
      deckTitle={deck?.title ?? "Interactive Math Lab & Step Solver"}
      onBack={() => router.push(`/study/${deckId}`)}
      cards={deck?.cards}
      deckId={deckId}
    />
  )
}
