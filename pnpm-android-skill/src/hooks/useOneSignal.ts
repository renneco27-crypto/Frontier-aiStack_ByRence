declare const median: any

import { useEffect, useCallback } from 'react'
import { OneSignalBridge } from '@/lib/capacitorOneSignal'
import { Capacitor } from '@capacitor/core'

export function useOneSignal() {
  const isNativeApp = Capacitor.isNativePlatform()
  const isMedianAvailable = typeof median !== 'undefined'

  const loginOneSignal = useCallback(async (userEmail: string) => {
    try {
      if (isNativeApp) {
        // Use Capacitor plugin for native Android
        await OneSignalBridge.login({ externalId: userEmail })
        console.log('[useOneSignal] Successfully registered with OneSignal (Native)')
      } else if (isMedianAvailable) {
        // Use Median bridge for web
        await median.onesignal.login(userEmail)
        console.log('[useOneSignal] Successfully registered with OneSignal (Median)')
      } else {
        console.warn('[useOneSignal] No OneSignal bridge available')
        return false
      }
      
      // Update database with OneSignal external user ID
      await fetch('/api/update-onesignal-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail })
      })
      
      return true
    } catch (error) {
      console.error('[useOneSignal] Registration failed:', error)
      return false
    }
  }, [isNativeApp, isMedianAvailable])

  const logoutOneSignal = useCallback(async () => {
    try {
      if (isNativeApp) {
        // Use Capacitor plugin for native Android
        await OneSignalBridge.logout()
        console.log('[useOneSignal] Successfully logged out from OneSignal (Native)')
      } else if (isMedianAvailable) {
        // Use Median bridge for web
        await median.onesignal.logout()
        console.log('[useOneSignal] Successfully logged out from OneSignal (Median)')
      } else {
        console.warn('[useOneSignal] No OneSignal bridge available')
        return false
      }
      return true
    } catch (error) {
      console.error('[useOneSignal] Logout failed:', error)
      return false
    }
  }, [isNativeApp, isMedianAvailable])

  const getOneSignalInfo = useCallback(async () => {
    try {
      if (isNativeApp) {
        // Use Capacitor plugin for native Android
        const result = await OneSignalBridge.getSubscriptionId()
        console.log('[useOneSignal] OneSignal subscription ID (Native):', result.subscriptionId)
        return { subscriptionId: result.subscriptionId }
      } else if (isMedianAvailable) {
        // Use Median bridge for web
        const info = await median.onesignal.info()
        console.log('[useOneSignal] OneSignal info (Median):', info)
        return info
      } else {
        console.warn('[useOneSignal] No OneSignal bridge available')
        return null
      }
    } catch (error) {
      console.error('[useOneSignal] Failed to get OneSignal info:', error)
      return null
    }
  }, [isNativeApp, isMedianAvailable])

  return {
    loginOneSignal,
    logoutOneSignal,
    getOneSignalInfo,
    isAvailable: isNativeApp || isMedianAvailable,
    platform: isNativeApp ? 'native' : (isMedianAvailable ? 'median' : 'none')
  }
}

