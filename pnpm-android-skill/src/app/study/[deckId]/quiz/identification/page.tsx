import IdentificationClient from './IdentificationClient'

export function generateStaticParams() {
  return [{ deckId: '_offline' }]
}

export default function Page() {
  return <IdentificationClient />
}
