'use client'

import { useEffect } from 'react'

/**
 * Executes a function during browser idle time, avoiding UI thread contention during load.
 */
function runWhenIdle(callback: () => void, delayMs = 1500): () => void {
  if (typeof window === 'undefined') return () => {}

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let idleId: number | undefined

  timeoutId = setTimeout(() => {
    if ('requestIdleCallback' in window) {
      idleId = (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(
        () => callback(),
        { timeout: 4000 }
      )
    } else {
      callback()
    }
  }, delayMs)

  return () => {
    if (timeoutId) clearTimeout(timeoutId)
    if (idleId && 'cancelIdleCallback' in window) {
      (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId)
    }
  }
}

export function useOfflineCache(urls: string[]) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !urls || urls.length === 0) {
      return
    }

    return runWhenIdle(async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        if (registration?.active) {
          registration.active.postMessage({
            type: 'CACHE_URLS',
            urls,
          })
        }
      } catch (error) {
        console.warn('Lazy offline cache non-fatal error:', error)
      }
    }, 2000) // Delay 2 seconds after mount so initial interactive paint completes
  }, [urls])
}

// prefetchDeckForOffline was removed. We now rely entirely on the OTA webapp ZIP bundle update method.

