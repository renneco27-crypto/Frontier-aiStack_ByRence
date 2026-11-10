import EnumerationClient from './EnumerationClient'

export function generateStaticParams() {
  return [{ deckId: '_offline' }]
}

export default function Page() {
  return <EnumerationClient />
}
