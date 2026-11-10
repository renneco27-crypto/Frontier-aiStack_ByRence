'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { soundEngine } from '@/utils/soundEngine'

export type BentoModeKey =
  | 'flashcards'
  | 'multiple-choice'
  | 'true-false'
  | 'enumeration'
  | 'blanks'
  | 'notes'
  | 'gallery'
  | 'math'
  | 'code'
  | 'stats'

interface ModeCardProps {
  mode: BentoModeKey
  label: string
  description: string
  count: string
  href: string
  disabled?: boolean
  // Optional backwards compatibility props if needed
  icon?: any
  color?: string
}

export default function ModeCard({
  mode,
  label,
  description,
  count,
  href,
  disabled = false,
}: ModeCardProps) {
  const router = useRouter()
  const [isTouched, setIsTouched] = useState(false)

  return (
    <button
      type="button"
      onClick={() => {
        if (disabled) return
        soundEngine.play('thocky')
        router.push(href)
      }}
      onTouchStart={() => setIsTouched(true)}
      onTouchEnd={() => setTimeout(() => setIsTouched(false), 400)}
      onTouchCancel={() => setIsTouched(false)}
      disabled={disabled}
      className={`study-bento-card group text-left w-full ${isTouched ? 'is-touched' : ''} disabled:opacity-40 disabled:pointer-events-none`}
    >
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <h2
            className={`font-display text-[14.5px] font-extrabold tracking-tight leading-snug ${
              disabled ? 'text-slate-400 group-hover:text-white transition-colors' : 'text-white'
            }`}
          >
            {label}
          </h2>
          <p className={`text-[11px] mt-0.5 ${disabled ? 'text-slate-500' : 'text-slate-400'}`}>
            {description}
          </p>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
            disabled ? 'bg-[#1E1B2E] text-slate-400' : 'bg-[#251E3E] text-[#C4B5FD]'
          }`}
        >
          {count}
        </span>
      </div>

      {/* Mode-specific exact 2D vector asset copied from knowunity_knowie_mobile_app_clone_fixed.html */}
      {mode === 'flashcards' && (
        <div
          className="bento-art-wrap absolute -bottom-2 -right-1.5 pointer-events-none"
          style={{ transform: 'rotate(-6deg)' }}
        >
          <svg width="86" height="72" viewBox="0 0 86 72" fill="none">
            <rect
              x="22"
              y="18"
              width="54"
              height="40"
              rx="8"
              transform="rotate(4 22 18)"
              fill="#2D2846"
              stroke="#4C4375"
              strokeWidth="1.5"
            />
            <rect
              x="14"
              y="16"
              width="54"
              height="40"
              rx="8"
              transform="rotate(-3 14 16)"
              fill="#EAE8E0"
              stroke="#C8C5B8"
              strokeWidth="1.5"
            />
            <g className="flashcard-top-actor">
              <rect
                x="10"
                y="14"
                width="54"
                height="38"
                rx="8"
                fill="#F4F3EE"
                stroke="#1C1C1E"
                strokeWidth="1.8"
              />
              <rect x="16" y="21" width="18" height="4" rx="2" fill="#9F67FF" />
              <rect
                x="16"
                y="29"
                width="34"
                height="3.5"
                rx="1.75"
                fill="#1C1C1E"
                className="grow-right-bar"
              />
              <rect x="16" y="35" width="24" height="3.5" rx="1.75" fill="#64748B" />
              <circle cx="54" cy="42" r="4" fill="#7CE0D3" />
            </g>
          </svg>
        </div>
      )}

      {mode === 'multiple-choice' && (
        <div
          className="bento-art-wrap absolute -bottom-2.5 -right-2 pointer-events-none"
          style={{ transform: 'rotate(-6deg)' }}
        >
          <svg width="82" height="70" viewBox="0 0 82 70" fill="none">
            <rect
              x="8"
              y="8"
              width="66"
              height="54"
              rx="11"
              fill="#EAE8E0"
              stroke="#C8C5B8"
              strokeWidth="1.5"
            />
            <rect x="14" y="14" width="25" height="19" rx="5" fill="#FFFFFF" />
            <circle cx="21" cy="23.5" r="3" fill="#CBD5E1" />
            <g className="mcq-tile-actor">
              <rect x="43" y="14" width="25" height="19" rx="5" fill="#7CE0D3" />
              <path
                d="M51.5 23.5L54.5 26.5L60.5 20.5"
                stroke="#103833"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            <rect x="14" y="37" width="25" height="19" rx="5" fill="#FFFFFF" />
            <circle cx="21" cy="46.5" r="3" fill="#CBD5E1" />
            <rect x="43" y="37" width="25" height="19" rx="5" fill="#FFFFFF" />
            <circle cx="50" cy="46.5" r="3" fill="#CBD5E1" />
          </svg>
        </div>
      )}

      {mode === 'true-false' && (
        <div className="absolute bottom-2.5 right-2.5 flex items-center pointer-events-none">
          <div className="fan-left-actor px-2.5 py-2 bg-[#EAE8E0] text-[#1C1C1E] rounded-lg text-[9px] font-black rotate-[-8deg] shadow-md border border-black/10">
            TRUE
          </div>
          <div className="fan-right-actor px-2.5 py-2 bg-[#7CE0D3] text-[#103833] rounded-lg text-[9px] font-black rotate-[6deg] -ml-1.5 shadow-md border border-black/10">
            FALSE
          </div>
        </div>
      )}

      {mode === 'enumeration' && (
        <div
          className="bento-art-wrap absolute -bottom-2 -right-2 pointer-events-none"
          style={{ transform: 'rotate(-6deg)' }}
        >
          <svg width="84" height="66" viewBox="0 0 84 66" fill="none">
            <rect
              x="8"
              y="8"
              width="66"
              height="50"
              rx="10"
              fill="#F4F3EE"
              stroke="#C8C5B8"
              strokeWidth="1.5"
            />
            {/* Row 1 */}
            <rect x="14" y="14" width="11" height="10" rx="3" fill="#7CE0D3" />
            <text
              x="19.5"
              y="21.5"
              textAnchor="middle"
              fill="#103833"
              fontSize="7.5"
              fontWeight="900"
              fontFamily="Inter, sans-serif"
            >
              1
            </text>
            <rect x="29" y="17" width="36" height="4" rx="2" fill="#1C1C1E" className="grow-right-bar" />
            {/* Row 2 */}
            <rect x="14" y="28" width="11" height="10" rx="3" fill="#9F67FF" />
            <text
              x="19.5"
              y="35.5"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="7.5"
              fontWeight="900"
              fontFamily="Inter, sans-serif"
            >
              2
            </text>
            <rect x="29" y="31" width="30" height="4" rx="2" fill="#1C1C1E" className="grow-right-bar" />
            {/* Row 3 */}
            <rect x="14" y="42" width="11" height="10" rx="3" fill="#F3A8BC" />
            <text
              x="19.5"
              y="49.5"
              textAnchor="middle"
              fill="#3D1E26"
              fontSize="7.5"
              fontWeight="900"
              fontFamily="Inter, sans-serif"
            >
              3
            </text>
            <rect x="29" y="45" width="34" height="4" rx="2" fill="#1C1C1E" className="grow-right-bar" />
          </svg>
        </div>
      )}

      {mode === 'blanks' && (
        <div
          className="bento-art-wrap absolute -bottom-2.5 -right-2 pointer-events-none"
          style={{ transform: 'rotate(-5deg)' }}
        >
          <svg width="94" height="72" viewBox="0 0 94 72" fill="none">
            {/* Book Hardcover Base */}
            <rect
              x="6"
              y="14"
              width="80"
              height="50"
              rx="8"
              fill="#C84B44"
              stroke="#8F2E29"
              strokeWidth="1.5"
            />
            {/* Left Cream Page */}
            <path
              d="M10 17C10 14.7909 11.7909 13 14 13H45V59H14C11.7909 59 10 57.2091 10 55V17Z"
              fill="#F4F3EE"
            />
            {/* Right Cream Page */}
            <path
              d="M47 13H78C80.2091 13 82 14.7909 82 17V55C82 57.2091 80.2091 59 78 59H47V13Z"
              fill="#EAE8E0"
            />
            {/* Center Spine */}
            <rect x="44.5" y="13" width="3" height="46" fill="#D4D2C8" />

            {/* Left Page Reading Lines */}
            <rect x="15" y="21" width="23" height="3" rx="1.5" fill="#1C1C1E" />
            <rect x="15" y="28" width="18" height="3" rx="1.5" fill="#94A3B8" />
            {/* Blank Slot 1: Fixed container outline + Left-locked highlight */}
            <rect
              x="15"
              y="34.5"
              width="24"
              height="7"
              rx="3.5"
              fill="#EDE9FE"
              stroke="#C4B5FD"
              strokeWidth="1"
              strokeDasharray="2 1.5"
            />
            <rect
              x="15"
              y="34.5"
              width="4"
              height="7"
              rx="3.5"
              fill="#9F67FF"
              className="blank-highlight-slot-1"
            />
            <rect x="15" y="45" width="24" height="3" rx="1.5" fill="#94A3B8" />

            {/* Right Page Reading Lines + Blank Slot 2 */}
            <rect x="51" y="20" width="22" height="3" rx="1.5" fill="#94A3B8" />
            <rect
              x="51"
              y="27"
              width="22"
              height="7"
              rx="3.5"
              fill="#E0F7F4"
              stroke="#4BAE9F"
              strokeWidth="1"
              strokeDasharray="2 1.5"
            />
            <rect
              x="51"
              y="27"
              width="4"
              height="7"
              rx="3.5"
              fill="#7CE0D3"
              className="blank-highlight-slot-2"
            />
            <rect x="51" y="38" width="23" height="3" rx="1.5" fill="#94A3B8" />

            {/* 2D Vector Pen Nib (Glides right as highlight grows) */}
            <g className="pen-nib-actor">
              <path d="M53 27L64 16L69 21L58 32L51 34L53 27Z" fill="#1C1C1E" />
              <path d="M62 18L67 23" stroke="#F2C94C" strokeWidth="2" />
            </g>
          </svg>
        </div>
      )}

      {mode === 'notes' && (
        <div
          className="bento-art-wrap absolute -bottom-2.5 -right-2 pointer-events-none"
          style={{ transform: 'rotate(-6deg)' }}
        >
          <svg width="94" height="74" viewBox="0 0 94 74" fill="none">
            <rect x="6" y="14" width="80" height="52" rx="9" fill="#4BAE9F" />
            <rect
              x="6"
              y="11"
              width="80"
              height="52"
              rx="9"
              fill="#7CE0D3"
              stroke="#1C1C1E"
              strokeWidth="1.6"
            />
            <path
              d="M11 16C11 13.7909 12.7909 12 15 12H45V58H15C12.7909 58 11 56.2091 11 54V16Z"
              fill="#F4F3EE"
            />
            <path
              d="M47 12H77C79.2091 12 81 13.7909 81 16V54C81 56.2091 79.2091 58 77 58H47V12Z"
              fill="#EAE8E0"
            />
            <rect x="44.5" y="12" width="3" height="46" fill="#D4D2C8" />
            <path d="M44 56H48V68L46 65.5L44 68V56Z" fill="#C84B44" />
            {/* Left Page Key Terms & 2x2 Table */}
            <rect x="16" y="19" width="16" height="4" rx="2" fill="#C84B44" />
            <rect x="16" y="26" width="23" height="3" rx="1.5" fill="#1C1C1E" />
            <rect x="16" y="32" width="20" height="3" rx="1.5" fill="#64748B" />
            <rect
              x="16"
              y="39"
              width="23"
              height="12"
              rx="2.5"
              fill="#FFFFFF"
              stroke="#CBD5E1"
              strokeWidth="1.2"
            />
            <line x1="27.5" y1="39" x2="27.5" y2="51" stroke="#CBD5E1" strokeWidth="1.2" />
            <line x1="16" y1="45" x2="39" y2="45" stroke="#CBD5E1" strokeWidth="1.2" />
            {/* Right Page Leaf: Static at rest, turns on hover/touch */}
            <g className="book-page-leaf">
              <path
                d="M46 12H75C77.2091 12 79 13.7909 79 16V53C79 55.2091 77.2091 57 75 57H46V12Z"
                fill="#FFFFFF"
                stroke="#D4D2C8"
                strokeWidth="1"
              />
              <rect x="51" y="19" width="21" height="4.5" rx="2" fill="#F2C94C" className="grow-right-bar" />
              <rect x="51" y="27" width="22" height="3" rx="1.5" fill="#1C1C1E" />
              <rect x="51" y="33" width="18" height="3" rx="1.5" fill="#64748B" />
              <rect x="51" y="39" width="21" height="3" rx="1.5" fill="#64748B" />
              <circle cx="69" cy="48" r="3.5" fill="#F3A8BC" />
            </g>
          </svg>
        </div>
      )}

      {mode === 'gallery' && (
        <div
          className="bento-art-wrap absolute -bottom-2 -right-1.5 pointer-events-none"
          style={{ transform: 'rotate(-5deg)' }}
        >
          <svg width="84" height="68" viewBox="0 0 84 68" fill="none">
            <rect
              x="24"
              y="12"
              width="48"
              height="48"
              rx="9"
              transform="rotate(6 24 12)"
              fill="#EAE8E0"
              stroke="#C8C5B8"
              strokeWidth="1.5"
            />
            <g className="flashcard-top-actor">
              <rect
                x="12"
                y="14"
                width="50"
                height="46"
                rx="9"
                fill="#F4F3EE"
                stroke="#1C1C1E"
                strokeWidth="1.8"
              />
              <rect x="17" y="19" width="40" height="28" rx="5" fill="#8ECAE6" />
              <circle cx="26" cy="27" r="4" fill="#F2C94C" />
              <path d="M17 44L29 32L39 41L46 35L57 45V47H17V44Z" fill="#4799AA" />
            </g>
          </svg>
        </div>
      )}

      {mode === 'math' && (
        <div
          className="bento-art-wrap absolute -bottom-2 -right-2 pointer-events-none"
          style={{ transform: 'rotate(-6deg)' }}
        >
          <svg width="80" height="64" viewBox="0 0 80 64" fill="none">
            <rect
              x="8"
              y="8"
              width="62"
              height="48"
              rx="10"
              fill="#EAE8E0"
              stroke="#C8C5B8"
              strokeWidth="1.5"
            />
            <line x1="16" y1="46" x2="62" y2="46" stroke="#94A3B8" strokeWidth="1.5" />
            <line x1="22" y1="16" x2="22" y2="50" stroke="#94A3B8" strokeWidth="1.5" />
            <path
              d="M18 42C28 42 32 20 56 18"
              stroke="#C84B44"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="34" cy="31" r="4" fill="#1C1C1E" className="math-dot-actor" />
          </svg>
        </div>
      )}

      {mode === 'code' && (
        <div
          className="bento-art-wrap absolute -bottom-2 -right-2 pointer-events-none"
          style={{ transform: 'rotate(-6deg)' }}
        >
          <svg width="82" height="64" viewBox="0 0 82 64" fill="none">
            <rect
              x="8"
              y="8"
              width="64"
              height="48"
              rx="10"
              fill="#262629"
              stroke="#3F3F46"
              strokeWidth="1.5"
            />
            <circle cx="16" cy="16" r="2.2" fill="#C84B44" />
            <circle cx="23" cy="16" r="2.2" fill="#F2C94C" />
            <circle cx="30" cy="16" r="2.2" fill="#7CE0D3" />
            <rect x="15" y="25" width="18" height="3.5" rx="1.75" fill="#F3A8BC" />
            <rect x="36" y="25" width="22" height="3.5" rx="1.75" fill="#7CE0D3" className="grow-right-bar" />
            <rect x="20" y="33" width="28" height="3.5" rx="1.75" fill="#8ECAE6" className="grow-right-bar" />
            <rect x="20" y="41" width="16" height="3.5" rx="1.75" fill="#F2C94C" />
          </svg>
        </div>
      )}

      {mode === 'stats' && (
        <div
          className="bento-art-wrap absolute -bottom-2 -right-2 pointer-events-none"
          style={{ transform: 'rotate(-6deg)' }}
        >
          <svg width="84" height="66" viewBox="0 0 84 66" fill="none">
            <rect
              x="10"
              y="10"
              width="64"
              height="48"
              rx="10"
              fill="#F4F3EE"
              stroke="#C8C5B8"
              strokeWidth="1.5"
            />
            {/* Fixed Bottom Baseline */}
            <line x1="16" y1="50" x2="68" y2="50" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
            {/* 4 Bars: Every bar's bottom is locked at y=50, growing strictly upward */}
            <rect x="18" y="30" width="9" height="20" rx="2.5" fill="#8ECAE6" className="stat-bar stat-bar-1" />
            <rect x="30" y="22" width="9" height="28" rx="2.5" fill="#9F67FF" className="stat-bar stat-bar-2" />
            <rect x="42" y="16" width="9" height="34" rx="2.5" fill="#7CE0D3" className="stat-bar stat-bar-3" />
            <rect x="54" y="24" width="9" height="26" rx="2.5" fill="#C84B44" className="stat-bar stat-bar-4" />
          </svg>
        </div>
      )}
    </button>
  )
}
