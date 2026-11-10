import CodeLabClient from './CodeLabClient'

export function generateStaticParams() {
  return [{ deckId: '_offline' }]
}

export default function Page() {
  return <CodeLabClient />
}
