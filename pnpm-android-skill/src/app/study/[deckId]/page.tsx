import StudyDashboardClient from './StudyDashboardClient'

export function generateStaticParams() {
  return [{ deckId: '_offline' }]
}

export default function Page() {
  return <StudyDashboardClient />
}
