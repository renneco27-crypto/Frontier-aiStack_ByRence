'use client'
import { useEffect } from 'react'

declare global {
  interface Window { adsbygoogle: unknown[] }
}

export default function AdSenseInit() {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (e) {}
  }, [])
  return null
}
