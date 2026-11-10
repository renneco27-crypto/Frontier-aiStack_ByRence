'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useUIStore } from '@/store/uiStore'
import { useToastStore } from '@/store/toastStore'

export default function AppBackHandler() {
  const pathname = usePathname()
  const router = useRouter()
  const lastBackPressRef = useRef<number>(0)
  const pathnameRef = useRef<string>(pathname)
  pathnameRef.current = pathname

  useEffect(() => {
    let removeListener: (() => void) | null = null

    const initBackHandler = async () => {
      if (typeof window === 'undefined') return

      try {
        const { App: CapApp } = await import('@capacitor/app')

        const handleBackButton = async () => {
          // 1. Check if UploadModal is open
          const { isUploadModalOpen, closeUploadModal } = useUIStore.getState()
          if (isUploadModalOpen) {
            closeUploadModal()
            return
          }

          // 2. Check if mobile sidebar drawer or open modal dialog is present
          const openDialog = document.querySelector('[role="dialog"][data-state="open"]')
          const mobileDrawer = document.querySelector('aside.translate-x-0')
          if (openDialog || mobileDrawer) {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))
            window.dispatchEvent(new CustomEvent('close-mobile-drawer'))
            return
          }

          // 3. Check if user is on any subpage (not root /)
          const currentPath = pathnameRef.current || window.location.pathname
          if (currentPath && currentPath !== '/' && currentPath !== '') {
            if (window.history.length > 1) {
              window.history.back()
            } else {
              router.push('/')
            }
            return
          }

          // 4. On root home page ('/'): require double back press within 2s to exit app
          const now = Date.now()
          if (now - lastBackPressRef.current < 2000) {
            CapApp.exitApp()
          } else {
            lastBackPressRef.current = now
            useToastStore.getState().addToast('Press back again to exit', 'info')
          }
        }

        const listener = await CapApp.addListener('backButton', handleBackButton)
        removeListener = () => {
          listener.remove()
        }
      } catch {
        // Fallback for non-Capacitor environment
      }
    }

    initBackHandler()

    return () => {
      if (removeListener) removeListener()
    }
  }, [router])

  return null
}
