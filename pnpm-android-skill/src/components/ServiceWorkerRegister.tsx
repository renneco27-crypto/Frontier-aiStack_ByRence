'use client'

import { useEffect } from 'react'
import { syncEngine } from '@/db/syncEngine'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // All assets are natively packaged in the app container.
    // Unregister any legacy service workers to eliminate redundant caching and worker bloat.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((r) => r.unregister())
      }).catch(() => {})
    }

    syncEngine.init()
  }, [])

  return null
}
