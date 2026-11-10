import NotesClient from './NotesClient'

export function generateStaticParams() {
  return [{ deckId: '_offline' }]
}

export default async function Page({
  params,
}: {
  params: Promise<{ deckId: string }>
}) {
  const resolved = await params
  return <NotesClient deckId={resolved?.deckId} />
}
