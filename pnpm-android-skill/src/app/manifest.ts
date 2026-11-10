import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StudyUp',
    short_name: 'StudyUp',
    description: 'Turn notes into knowledge with offline visual recall and AI',
    start_url: '/',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#9333ea',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
