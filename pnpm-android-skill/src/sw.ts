/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist, NetworkFirst, StaleWhileRevalidate } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const CACHE_VERSION = process.env.NEXT_PUBLIC_APP_CACHE_SHA || 'v8';
const CACHE_NAME = `stitchapp-dynamic-${CACHE_VERSION}`;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher({ request, url }) {
        return (
          request.destination === 'document' ||
          request.mode === 'navigate' ||
          url.pathname.startsWith('/study') ||
          url.pathname.startsWith('/feed') ||
          url.pathname.startsWith('/leaderboard') ||
          url.pathname.startsWith('/code') ||
          url.pathname === '/'
        )
      },
      handler: new NetworkFirst({
        cacheName: CACHE_NAME,
        networkTimeoutSeconds: 3,
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
})

serwist.addEventListeners()

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('stitchapp-dynamic-') && cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})

// Preserved handlers — called by useOfflineCache() and prefetchDeckForOffline()
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data?.type === 'CACHE_URLS') {
    const urls: string[] = Array.isArray(event.data.urls) ? event.data.urls : []
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(CACHE_NAME)
          for (const url of urls) {
            try {
              // 1. Fetch & cache standard document HTML
              const res = await fetch(url, {
                headers: { 'X-Lazy-Cache': '1' },
              })
              if (res && res.status === 200) {
                await cache.put(url, res.clone())
              }

              // 2. Also prefetch Next.js RSC payload for client-side navigation
              try {
                const rscRes = await fetch(url, {
                  headers: { 'RSC': '1', 'Next-Router-Prefetch': '1', 'X-Lazy-Cache': '1' },
                })
                if (rscRes && rscRes.status === 200) {
                  await cache.put(new Request(url, { headers: { 'RSC': '1' } }), rscRes)
                }
              } catch {}

              // Stagger slightly to avoid saturating network/CPU
              await new Promise((resolve) => setTimeout(resolve, 100))
            } catch (err) {
              // Ignore single URL fetch error
            }
          }
        } catch (e) {
          // Fail-safe
        }
      })()
    )
  }
})