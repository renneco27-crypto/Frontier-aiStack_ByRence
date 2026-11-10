'use client'

import { useState, useEffect } from 'react'

interface ServerStatusBadgeProps {
  compact?: boolean
  className?: string
}

export default function ServerStatusBadge({ compact = false, className = '' }: ServerStatusBadgeProps) {
  const [isOnline, setIsOnline] = useState<boolean | null>(null)
  const [extensionOnline, setExtensionOnline] = useState<boolean>(false)

  useEffect(() => {
    let mounted = true

    async function checkStatus() {
      try {
        const res = await fetch('/api/relay/status?type=client', {
          signal: AbortSignal.timeout(3000),
          cache: 'no-store',
        })
        if (mounted) {
          if (res.ok) {
            const data = await res.json().catch(() => ({}))
            setIsOnline(true)
            setExtensionOnline(!!data.extensionOnline)
          } else {
            setIsOnline(false)
            setExtensionOnline(false)
          }
        }
      } catch {
        if (mounted) {
          setIsOnline(false)
          setExtensionOnline(false)
        }
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 3000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const isRelayReady = isOnline && extensionOnline

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 ${className}`}
        title={
          isRelayReady
            ? 'Server & Extension Relay Online'
            : isOnline
            ? 'Server Online (Extension is Offline / Closed)'
            : 'Server Offline'
        }
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isRelayReady ? 'bg-emerald-400' : 'bg-red-400'
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              isRelayReady ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'
            }`}
          />
        </span>
      </span>
    )
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-300 ${
        isRelayReady
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'
      } ${className}`}
      title={
        isRelayReady
          ? 'Server Online • Extension Relay Connected'
          : isOnline
          ? 'Server Online • Extension Relay Worker is Closed / Disconnected'
          : 'Server Offline'
      }
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            isRelayReady ? 'bg-emerald-400' : 'bg-red-400'
          }`}
        />
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isRelayReady ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-red-500 shadow-[0_0_6px_#ef4444]'
          }`}
        />
      </span>
      <span>
        {isOnline === null
          ? 'Checking…'
          : isRelayReady
          ? 'Server Active'
          : 'Server Offline'}
      </span>
    </div>
  )
}
