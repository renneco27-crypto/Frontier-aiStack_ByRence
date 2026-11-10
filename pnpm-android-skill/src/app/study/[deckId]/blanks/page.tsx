import { Suspense } from 'react'
import BlanksClient from './BlanksClient'

export function generateStaticParams() {
  return [{ deckId: '_offline' }]
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BlanksClient />
    </Suspense>
  )
}
