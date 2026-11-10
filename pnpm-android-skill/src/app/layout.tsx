import Script from 'next/script'
import type { Metadata } from 'next'
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import ToastContainer from '@/components/ToastContainer'
import AuthWrapper from '@/components/AuthWrapper'
import Sidebar from '@/components/Sidebar'
import OfflineIndicator from '@/components/OfflineIndicator'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import UploadModal from '@/components/UploadModal'
import VersionUpdateModal from '@/components/VersionUpdateModal'
import MatrixRainBackground from '@/components/MatrixRainBackground'
import AppBackHandler from '@/components/AppBackHandler'
import './globals.css'
import 'katex/dist/katex.min.css'

const beVietnamPro = Be_Vietnam_Pro({
  weight: ['400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  display: 'swap',
  fallback: ['sans-serif'],
  variable: '--font-sans',
})

const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  display: 'swap',
  fallback: ['sans-serif'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'StudyUp',
  description: 'Turn notes into knowledge',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'StudyUp',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${beVietnamPro.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <head>
        <meta name="google-site-verification" content="QhAAXalTmd1c0Wcv1nLckrZxn4FMSn0ZfAP1or9v-_8" />
        <meta name="google-adsense-account" content="ca-pub-9510492301387912" />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9510492301387912"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-full flex flex-col relative bg-[#06070b] text-white">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AppBackHandler />
          <ServiceWorkerRegister />
          <OfflineIndicator />
          <MatrixRainBackground opacity={0.25} speedMultiplier={0.35} maxStreams={10} />
          <AuthWrapper>
            <div className="w-full max-w-[520px] mx-auto min-h-screen flex flex-col relative z-10 bg-[#0b0c14] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.65)] overflow-x-clip">
              <div className="senthora-bottom-glow" />
              <main className="flex-1 min-w-0 flex flex-col relative z-10">{children}</main>
              <Sidebar />
            </div>
          </AuthWrapper>
          <UploadModal />
          <VersionUpdateModal />
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  )
}
