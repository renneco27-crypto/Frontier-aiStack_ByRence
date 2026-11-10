'use client'

import { Mic, MicOff, Volume2 } from 'lucide-react'
import type { Card } from '@/lib/zodSchemas'
import MathFormattedText from '@/components/MathFormattedText'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useTTS } from '@/hooks/useTTS'
import { useState, useEffect } from 'react'
import { soundEngine } from '@/utils/soundEngine'

interface FlashcardDeckProps {
  card: Card
  cardIndex?: number
  totalInBatch?: number
  isFlipped: boolean
  animationClass: 'none' | 'slide-right' | 'slide-left' | 'slide-in'
  onFlip: () => void
  onVerify?: (answer: string) => Promise<{ correct: boolean; isEvaluated: boolean }>
}

export default function FlashcardDeck({
  card,
  cardIndex = 0,
  totalInBatch = 1,
  isFlipped,
  animationClass,
  onFlip,
  onVerify,
}: FlashcardDeckProps) {
  const animClass = animationClass === 'none' ? '' : animationClass

  const { speakSingle } = useTTS()
  const { isListening, transcript, interimTranscript, toggleListening, stopListening, setTranscript } =
    useSpeechRecognition()
  const [userAnswer, setUserAnswer] = useState('')
  const [isCorrectState, setIsCorrectState] = useState<boolean | null>(null)
  const [starred, setStarred] = useState(false)

  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  useEffect(() => {
    if (isListening) {
      setUserAnswer('')
      setTranscript('')
      setIsCorrectState(null)
    }
  }, [isListening, setTranscript])

  useEffect(() => {
    if (isListening && (transcript || interimTranscript)) {
      setUserAnswer((transcript + interimTranscript).trim())
      setIsCorrectState(null)
    }
  }, [isListening, transcript, interimTranscript])

  useEffect(() => {
    setUserAnswer('')
    setTranscript('')
    setIsCorrectState(null)
  }, [card.id, setTranscript])

  useEffect(() => {
    const trimmed = userAnswer.trim()
    if (!trimmed || isCorrectState === true || !onVerify) return
    const timeout = setTimeout(async () => {
      const res = await onVerify(trimmed)
      if (res.isEvaluated) {
        setIsCorrectState(res.correct)
        stopListening()
        if (!res.correct) {
          setUserAnswer('')
          setTranscript('')
        }
      }
    }, 800)
    return () => clearTimeout(timeout)
  }, [userAnswer, isCorrectState, onVerify, stopListening, setTranscript])

  useEffect(() => {
    if (isCorrectState === false) {
      setUserAnswer('')
      setTranscript('')
    }
  }, [isCorrectState, stopListening, setTranscript])

  const borderOverride =
    isCorrectState === true
      ? '!border-[#1ed760]'
      : isCorrectState === false
        ? '!border-[#ff5252]'
        : ''

  return (
    <div className={`w-full aspect-square max-w-[390px] flex items-center justify-center relative mx-auto ${animClass}`}>
      {/* Foreground Active Card (1:1 Reference .flashcard-face) */}
      <div
        id="fcActiveContainer"
        onClick={() => {
          soundEngine.play('thocky')
          onFlip()
        }}
        className="w-full h-full perspective-1000 cursor-pointer relative select-none"
      >
        <div className={`flashcard-3d-wrapper ${isFlipped ? 'is-flipped' : ''}`}>
          {/* FRONT FACE */}
          <div className={`flashcard-face ${borderOverride}`}>
            {/* Top Row: Chapter + Audio */}
            <div className="flex items-center justify-between text-[#9d94ba] text-[12px] font-bold uppercase tracking-wider">
              <span className="truncate max-w-[200px]">{card.chapter || 'Flashcard'}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  stopListening()
                  speakSingle(card.front)
                }}
                className="w-8 h-8 flex items-center justify-center text-[#9d94ba] hover:text-white transition"
                title="Pronounce question"
              >
                <Volume2 size={16} />
              </button>
            </div>

            {/* Center Question Text */}
            <div className="flex-1 overflow-y-auto no-scrollbar py-2 flex items-center justify-center">
              <div
                id="fcFrontText"
                className="flashcard-question-text text-[19px] sm:text-[21px] text-center text-white px-1 break-words w-full"
              >
                <MathFormattedText text={card.front} />
              </div>
            </div>

            {/* Voice / Answer Verification Input + Centered Mic Below */}
            <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
              <div className="w-full bg-[#0b0c14] border border-[#222536] rounded-[14px] px-3.5 py-1.5 focus-within:border-[#7e57ff] transition-colors">
                <input
                  type="text"
                  className="w-full bg-transparent text-[13.5px] font-medium text-white placeholder:text-[#8e92a8] focus:outline-none"
                  placeholder={isListening ? 'Listening… speak answer' : 'Type or speak answer…'}
                  value={userAnswer}
                  onChange={(e) => {
                    setUserAnswer(e.target.value)
                    setTranscript(e.target.value)
                    setIsCorrectState(null)
                  }}
                />
              </div>

              {/* Centered Mic Button below textinput div */}
              <div className="flex items-center justify-center py-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isListening) {
                      setUserAnswer('')
                      setTranscript('')
                    }
                    setIsCorrectState(null)
                    toggleListening()
                  }}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                    isListening
                      ? 'bg-[#1ed760] text-[#0b0c14] ring-4 ring-[#1ed760]/30 animate-pulse scale-105'
                      : 'bg-[#1c1f2e] border-2 border-[#2e324a] text-[#c084fc] hover:text-white hover:bg-[#282d42] active:scale-95'
                  }`}
                  title={isListening ? 'Stop listening' : 'Speak answer'}
                  aria-label={isListening ? 'Stop listening' : 'Speak answer'}
                >
                  <Mic size={26} />
                </button>
              </div>

              <div className="flex items-center justify-between text-[#8e92a8] text-[12.5px] font-semibold">
                <span className="text-[12px] text-[#9d7eff] cursor-pointer hover:underline" onClick={onFlip}>
                  Tap to flip ↕
                </span>
                <span id="fcCardCountBadge">
                  {cardIndex + 1} of {totalInBatch}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    soundEngine.play('poppy')
                    setStarred((s) => !s)
                  }}
                  className={`p-1 transition ${starred ? 'text-[#facc15]' : 'text-[#8e92a8] hover:text-white'}`}
                  title="Flag card"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill={starred ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* BACK FACE */}
          <div className="flashcard-face flashcard-back">
            <div className="flex items-center justify-between text-[#9d94ba] text-[12px] font-bold uppercase tracking-wider">
              <span className="truncate max-w-[200px]">{card.chapter || 'Answer'}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  stopListening()
                  speakSingle(card.back)
                }}
                className="w-8 h-8 flex items-center justify-center text-[#9d94ba] hover:text-white transition"
                title="Pronounce answer"
              >
                <Volume2 size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar py-2 flex items-center justify-center">
              <div
                id="fcBackText"
                className="flashcard-question-text text-[18px] sm:text-[20px] text-center text-white px-1 leading-relaxed break-words w-full"
              >
                <MathFormattedText text={card.back} />
              </div>
            </div>

            <div className="flex items-center justify-between text-[#9d94ba] text-[13px] font-semibold">
              <span className="text-[12px] text-[#9d7eff] cursor-pointer hover:underline" onClick={onFlip}>
                Tap to flip ↕
              </span>
              <span>Verified Answer</span>
              <span className="w-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
