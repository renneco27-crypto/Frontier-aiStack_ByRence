import { useState, useCallback, useRef, useEffect } from 'react'

const getSRClass = () =>
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null

function buildRecognition(
  SRC: any,
  onFinal: (text: string) => void,
  onInterim: (text: string) => void,
  onEnd: () => void,
  onError: (err: string) => void,
  isOfflineMode: boolean = false
) {
  const r = new SRC()
  // When offline on mobile, continuous = false triggers the phone's native on-device speech recognizer
  r.continuous = !isOfflineMode
  r.interimResults = !isOfflineMode
  r.lang = 'en-US'
  r.maxAlternatives = 1

  r.onresult = (event: any) => {
    let final = ''
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript
      if (event.results[i].isFinal || isOfflineMode) final += t + ' '
      else interim += t
    }
    if (final) onFinal(final)
    if (interim !== undefined) onInterim(interim)
  }

  r.onerror = (e: any) => onError(e.error)
  r.onend = onEnd

  return r
}

// Continuous mode re-delivers the same finalized segment, so strip any tail of the
// previously appended text that the new final starts with (e.g. "jeremy bentham" twice).
function dedupeOverlap(prev: string, next: string): string {
  const prevWords = prev.trim() ? prev.trim().split(/\s+/) : []
  const nextWords = next.trim() ? next.trim().split(/\s+/) : []
  if (!nextWords.length) return ''
  if (!prevWords.length) return next.trim()
  // Exact duplicate — entire phrase already appended, discard
  if (prevWords.join(' ') === nextWords.join(' ')) return ''
  for (let n = Math.min(prevWords.length, nextWords.length); n >= 1; n--) {
    if (prevWords.slice(-n).join(' ') === nextWords.slice(0, n).join(' ')) {
      return nextWords.slice(n).join(' ')
    }
  }
  return next.trim()
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [supported] = useState(() => !!getSRClass())
  const [isOffline, setIsOffline] = useState(false)

  const activeRef = useRef<any>(null)     // currently running instance
  const userStoppedRef = useRef(false)    // did the user explicitly stop?
  const isListeningRef = useRef(false)
  const lastFinalRef = useRef('')         // last finalized text appended (dedupe helper)
  const maxDurationTimerRef = useRef<any>(null)
  const offlineModeRef = useRef(false)
  isListeningRef.current = isListening

  // Detect network online/offline state
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      offlineModeRef.current = false
    }
    const handleOffline = () => {
      setIsOffline(true)
      offlineModeRef.current = true
    }

    if (typeof window !== 'undefined') {
      if (!navigator.onLine) {
        setIsOffline(true)
        offlineModeRef.current = true
      }
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  const stopListening = useCallback(() => {
    userStoppedRef.current = true
    setIsListening(false)
    setInterimTranscript('')
    lastFinalRef.current = ''
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current)
      maxDurationTimerRef.current = null
    }
    if (activeRef.current) {
      try {
        activeRef.current.onend = null
        activeRef.current.onerror = null
        activeRef.current.onresult = null
        activeRef.current.abort()
      } catch (_) {}
      activeRef.current = null
    }
  }, [])

  const startInstance = useCallback((forceOffline: boolean = false) => {
    const SRC = getSRClass()
    if (!SRC) return

    // Immediately kill any lingering active instance so hardware mic resets cleanly
    if (activeRef.current) {
      try {
        activeRef.current.onend = null
        activeRef.current.onerror = null
        activeRef.current.onresult = null
        activeRef.current.abort()
      } catch (_) {}
      activeRef.current = null
    }

    const useOfflineEngine = forceOffline || offlineModeRef.current || (typeof navigator !== 'undefined' && !navigator.onLine)

    const r = buildRecognition(
      SRC,
      (finalText: string) => {
        const deduped = dedupeOverlap(lastFinalRef.current, finalText)
        if (deduped) setTranscript(prev => prev + deduped + ' ')
        lastFinalRef.current = finalText.trim()
      },
      (interimText: string) => {
        setInterimTranscript(interimText)
      },
      () => {
        // onend — in offline (non-continuous) mode each utterance is one-shot.
        // Auto-restarting causes Android to re-deliver the previous final segment.
        // In continuous (online) mode, restart to keep the mic hot.
        if (!userStoppedRef.current && isListeningRef.current && !useOfflineEngine) {
          try {
            startInstance(false)
          } catch (_) {}
        } else if (!useOfflineEngine) {
          setIsListening(false)
          setInterimTranscript('')
        } else {
          // offline: stay in "listening" state visually but don't restart the engine
          // (user must tap mic again for next utterance to avoid double-delivery)
          setIsListening(false)
          setInterimTranscript('')
        }
      },
      (err: string) => {
        // If network error occurs while speaking, immediately switch to on-device offline transcriber
        if (err === 'network') {
          console.log('[SpeechRecognition] Network error detected. Activating phone on-device offline transcriber...')
          offlineModeRef.current = true
          setIsOffline(true)
          if (!userStoppedRef.current && isListeningRef.current) {
            try {
              startInstance(true)
            } catch (_) {}
            return
          }
        }

        if (err !== 'no-speech' && err !== 'aborted' && err !== 'network') {
          userStoppedRef.current = true
          setIsListening(false)
        }
      },
      useOfflineEngine
    )

    try {
      r.start()
      activeRef.current = r
    } catch (e: any) {
      if (e?.message?.includes('already started')) return
      userStoppedRef.current = true
      setIsListening(false)
    }
  }, [])

  const startListening = useCallback(() => {
    // Instant clean reset of all speech recognition buffers
    userStoppedRef.current = false
    setTranscript('')
    setInterimTranscript('')
    lastFinalRef.current = ''
    setIsListening(true)
    startInstance(offlineModeRef.current)

    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current)
    maxDurationTimerRef.current = setTimeout(() => {
      if (isListeningRef.current) stopListening()
    }, 25000)
  }, [startInstance, stopListening])

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) stopListening()
    else startListening()
  }, [startListening, stopListening])

  useEffect(() => {
    return () => {
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current)
      if (activeRef.current) {
        try { activeRef.current.abort() } catch (_) {}
      }
    }
  }, [])

  return {
    isListening,
    transcript,
    interimTranscript,
    supported,
    isOffline,
    startListening,
    stopListening,
    toggleListening,
    setTranscript,
  }
}
