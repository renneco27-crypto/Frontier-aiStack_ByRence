export default function OfflinePage() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 40,
        textAlign: 'center',
        background: '#0a0c10',
        color: '#fff',
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>You&apos;re offline</h1>
      <p style={{ opacity: 0.7, maxWidth: 400 }}>
        Previously visited decks are still available. Reconnect to sync your
        progress.
      </p>
    </main>
  )
}