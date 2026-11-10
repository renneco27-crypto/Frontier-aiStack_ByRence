import MultipleChoiceClient from './MultipleChoiceClient'

export function generateStaticParams() {
  return [{ deckId: '_offline' }]
}

export default function Page() {
  return <MultipleChoiceClient />
}
