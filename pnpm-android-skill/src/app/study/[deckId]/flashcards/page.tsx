import { Suspense } from 'react'
import FlashcardsClient from './FlashcardsClient'

export function generateStaticParams() {
  return [{ deckId: '_offline' }]
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FlashcardsClient />
    </Suspense>
  )
}
