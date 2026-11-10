import TrueFalseClient from './TrueFalseClient'

export function generateStaticParams() {
  return [{ deckId: '_offline' }]
}

export default function Page() {
  return <TrueFalseClient />
}
