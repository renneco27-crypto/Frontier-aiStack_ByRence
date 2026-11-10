'use client'

import React, { useEffect, useState, useRef } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'

interface TerminalBlinkerUserProps {
  className?: string
  compact?: boolean
}

export default function TerminalBlinkerUser({
  className = '',
  compact = false,
}: TerminalBlinkerUserProps) {
  const [userName, setUserName] = useState<string>('')
  const [displayedText, setDisplayedText] = useState<string>('')
  const [isTyping, setIsTyping] = useState<boolean>(false)

  // Fetch logged in user email / name
  useEffect(() => {
    const supabase = createBrowserSupabase()

    const resolveName = (user: any) => {
      if (!user) return ''
      // Try metadata first
      const metaName =
        user.user_metadata?.first_name ||
        user.user_metadata?.name?.split(' ')[0] ||
        user.user_metadata?.full_name?.split(' ')[0]

      if (metaName && typeof metaName === 'string' && metaName.trim()) {
        const clean = metaName.trim()
        return clean.charAt(0).toUpperCase() + clean.slice(1)
      }

      // Try email e.g. Maryaa@gmail.com -> Maryaa
      if (user.email) {
        const rawPrefix = user.email.split('@')[0] || ''
        const rawFirst = rawPrefix.split(/[._-]/)[0] || rawPrefix
        if (rawFirst) {
          return rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1)
        }
      }

      return 'Scholar'
    }

    supabase.auth.getSession().then(({ data }: any) => {
      if (data?.session?.user) {
        const name = resolveName(data.session.user)
        setUserName(name ? `${name}!` : '')
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user) {
        const name = resolveName(session.user)
        setUserName(name ? `${name}!` : '')
      } else {
        setUserName('')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Terminal typewriter effect triggered immediately and every 20 seconds
  useEffect(() => {
    if (!userName) {
      setDisplayedText('')
      return
    }

    let typeTimer: NodeJS.Timeout
    let cycleTimer: NodeJS.Timeout

    const runTypewriter = () => {
      setIsTyping(true)
      let currentIdx = 0
      setDisplayedText('')

      const step = () => {
        if (currentIdx <= userName.length) {
          setDisplayedText(userName.slice(0, currentIdx))
          currentIdx++
          typeTimer = setTimeout(step, 90)
        } else {
          setIsTyping(false)
        }
      }

      step()
    }

    // Run initial typewriter
    runTypewriter()

    // Repeat every 20 seconds
    cycleTimer = setInterval(() => {
      runTypewriter()
    }, 20000)

    return () => {
      clearTimeout(typeTimer)
      clearInterval(cycleTimer)
    }
  }, [userName])

  if (!userName && !displayedText) return null

  return (
    <div
      className={`inline-flex items-center gap-1 select-none transition-all ${className}`}
      title={`Logged in as ${userName.replace('!', '')}`}
    >
      <span className="text-white font-display font-bold tracking-tight">
        {displayedText || userName}
      </span>
      {/* Terminal Blinking Cursor: pure white, authentic terminal block without border boxes */}
      <span
        className="inline-block w-2 h-4 sm:h-5 bg-white animate-pulse align-middle ml-0.5 rounded-[1px]"
        style={{
          boxShadow: '0 0 6px rgba(255, 255, 255, 0.9)',
          animationDuration: isTyping ? '0.3s' : '0.8s',
        }}
      />
    </div>
  )
}
