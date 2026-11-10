import ImagesClient from './ImagesClient'

export function generateStaticParams() {
  return [{ deckId: '_offline' }]
}

export default async function Page({
  params,
}: {
  params: Promise<{ deckId: string }>
}) {
  const resolved = await params
  return <ImagesClient deckId={resolved?.deckId} />
}
