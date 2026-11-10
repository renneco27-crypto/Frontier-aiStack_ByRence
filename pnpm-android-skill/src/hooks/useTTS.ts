'use client'

import { useEffect, useState } from 'react'
import { ttsService, TTSState, TTSQueueItem } from '@/lib/ttsService'

export function useTTS() {
  const [state, setState] = useState<TTSState>(ttsService.getState())

  useEffect(() => {
    const unsubscribe = ttsService.subscribe((newState) => {
      setState(newState)
    })
    return unsubscribe
  }, [])

  return {
    ...state,
    speakSingle: (text: string, rate?: number) => ttsService.speakSingle(text, rate),
    startQueue: (items: TTSQueueItem[], startIndex?: number) => ttsService.startQueue(items, startIndex),
    pause: () => ttsService.pause(),
    resume: () => ttsService.resume(),
    togglePlayPause: () => ttsService.togglePlayPause(),
    stop: () => ttsService.stop(),
    nextItem: () => ttsService.nextItem(),
    prevItem: () => ttsService.prevItem(),
    setRate: (rate: number) => ttsService.setRate(rate),
  }
}
