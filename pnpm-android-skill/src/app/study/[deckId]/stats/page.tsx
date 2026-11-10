import StatsClient from './StatsClient'

export function generateStaticParams() {
  return [{ deckId: '_offline' }]
}

export default function Page() {
  return <StatsClient />
}
