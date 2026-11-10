'use client'

import React from 'react'

interface ShootingStarsBackgroundProps {
  className?: string
  style?: React.CSSProperties
}

export default function ShootingStarsBackground({ className, style }: ShootingStarsBackgroundProps) {
  return (
    <div
      className={className || "absolute top-[205px] left-0 right-0 bottom-[50px] pointer-events-none overflow-hidden select-none z-0"}
      aria-hidden="true"
      style={{
        maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 8%, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 8%, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 100%)',
        ...style,
      }}
    >
      <svg
        className="w-full h-full min-h-[580px]"
        viewBox="0 0 480 640"
        fill="none"
        preserveAspectRatio="xMidYMin slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Shooting Star Trail Gradient: White -> Cyan -> Violet -> Transparent */}
          <linearGradient id="shooting-trail-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="28%" stopColor="#67e8f9" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#c084fc" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Minimalist Geometric Crescent Moon (Upper Right below wave, subtle 17% opacity) */}
        <g transform="translate(415, 68)">
          <path
            d="M -7 -19 A 21 21 0 1 0 19 7 A 16.5 16.5 0 1 1 -7 -19 Z"
            fill="#e0f2fe"
            opacity="0.17"
            style={{ filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.25))' }}
          />
        </g>

        {/* Minimalist Geometric Constellations with rounded edges and joins */}
        <g
          stroke="#38bdf8"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.35"
        >
          {/* Constellation Alpha (Upper Left) */}
          <polyline points="45,85 85,65 135,80 165,48" />
          {/* Constellation Beta (Middle Right) */}
          <polyline points="305,175 350,148 400,162 432,128 392,105 350,148" />
          {/* Constellation Gamma (Lower Left) */}
          <polyline points="55,305 105,285 140,320 190,302" />
        </g>

        {/* Constellation Pivot Stars */}
        <g fill="#7dd3fc" opacity="0.85">
          <circle cx="45" cy="85" r="2" />
          <circle cx="85" cy="65" r="1.8" />
          <circle cx="135" cy="80" r="2.2" />
          <circle cx="165" cy="48" r="1.6" />

          <circle cx="305" cy="175" r="1.8" />
          <circle cx="350" cy="148" r="2.2" />
          <circle cx="400" cy="162" r="1.7" />
          <circle cx="432" cy="128" r="2" />
          <circle cx="392" cy="105" r="1.6" />

          <circle cx="55" cy="305" r="1.8" />
          <circle cx="105" cy="285" r="2" />
          <circle cx="140" cy="320" r="1.6" />
          <circle cx="190" cy="302" r="2.1" />
        </g>

        {/* Pulsing Starlight Starfield */}
        <g id="starfield">
          {/* Soft Circle Pulse Stars */}
          <circle className="pulse-star" cx="55" cy="35" r="1.2" fill="#f8fafc" style={{ animationDuration: '3.2s', animationDelay: '-0.8s' }} />
          <circle className="pulse-star" cx="185" cy="65" r="0.9" fill="#7dd3fc" style={{ animationDuration: '2.8s', animationDelay: '-1.5s' }} />
          <circle className="pulse-star" cx="280" cy="30" r="1.4" fill="#f8fafc" style={{ animationDuration: '3.9s', animationDelay: '-2.1s' }} />
          <circle className="pulse-star" cx="360" cy="78" r="0.8" fill="#c084fc" style={{ animationDuration: '2.6s', animationDelay: '-0.4s' }} />
          <circle className="pulse-star" cx="465" cy="130" r="1.1" fill="#f8fafc" style={{ animationDuration: '3.5s', animationDelay: '-1.9s' }} />
          <circle className="pulse-star" cx="75" cy="170" r="1.3" fill="#7dd3fc" style={{ animationDuration: '3.1s', animationDelay: '-2.7s' }} />
          <circle className="pulse-star" cx="230" cy="160" r="1.0" fill="#f8fafc" style={{ animationDuration: '4.0s', animationDelay: '-0.5s' }} />
          <circle className="pulse-star" cx="425" cy="210" r="1.2" fill="#c084fc" style={{ animationDuration: '3.3s', animationDelay: '-1.2s' }} />
          <circle className="pulse-star" cx="135" cy="275" r="0.9" fill="#f8fafc" style={{ animationDuration: '2.9s', animationDelay: '-2.3s' }} />
          <circle className="pulse-star" cx="295" cy="295" r="1.1" fill="#7dd3fc" style={{ animationDuration: '3.7s', animationDelay: '-3.0s' }} />
          <circle className="pulse-star" cx="470" cy="325" r="1.0" fill="#f8fafc" style={{ animationDuration: '3.4s', animationDelay: '-0.9s' }} />
          <circle className="pulse-star" cx="45" cy="375" r="1.3" fill="#c084fc" style={{ animationDuration: '3.8s', animationDelay: '-1.7s' }} />
          <circle className="pulse-star" cx="210" cy="405" r="0.8" fill="#f8fafc" style={{ animationDuration: '2.7s', animationDelay: '-2.5s' }} />
          <circle className="pulse-star" cx="365" cy="425" r="1.2" fill="#7dd3fc" style={{ animationDuration: '3.6s', animationDelay: '-1.1s' }} />
          <circle className="pulse-star" cx="120" cy="490" r="1.0" fill="#f8fafc" style={{ animationDuration: '3.3s', animationDelay: '-0.6s' }} />
          <circle className="pulse-star" cx="270" cy="520" r="1.2" fill="#c084fc" style={{ animationDuration: '3.9s', animationDelay: '-2.2s' }} />
          <circle className="pulse-star" cx="440" cy="505" r="0.9" fill="#7dd3fc" style={{ animationDuration: '3.0s', animationDelay: '-1.4s' }} />

          {/* 4-Point Geometric Diamond Stars */}
          <path
            className="diamond-star"
            d="M 105 40 L 106.5 44.5 L 111 46 L 106.5 47.5 L 105 52 L 103.5 47.5 L 99 46 L 103.5 44.5 Z"
            fill="#ffffff"
            style={{ animationDuration: '3.4s', animationDelay: '-1.2s' }}
          />
          <path
            className="diamond-star"
            d="M 260 100 L 261.3 103.7 L 265 105 L 261.3 106.3 L 260 110 L 258.7 106.3 L 255 105 L 258.7 103.7 Z"
            fill="#e0f2fe"
            style={{ animationDuration: '4.1s', animationDelay: '-2.4s' }}
          />
          <path
            className="diamond-star"
            d="M 385 190 L 386.8 195.2 L 392 197 L 386.8 198.8 L 385 204 L 383.2 198.8 L 378 197 L 383.2 195.2 Z"
            fill="#ffffff"
            style={{ animationDuration: '3.7s', animationDelay: '-0.5s' }}
          />
          <path
            className="diamond-star"
            d="M 150 345 L 151.5 349.5 L 156 351 L 151.5 352.5 L 150 357 L 148.5 352.5 L 144 351 L 148.5 349.5 Z"
            fill="#e0f2fe"
            style={{ animationDuration: '3.2s', animationDelay: '-1.8s' }}
          />
          <path
            className="diamond-star"
            d="M 335 375 L 336.3 378.7 L 340 380 L 336.3 381.3 L 335 385 L 333.7 381.3 L 330 380 L 333.7 378.7 Z"
            fill="#ffffff"
            style={{ animationDuration: '4.5s', animationDelay: '-3.1s' }}
          />
          <path
            className="diamond-star"
            d="M 230 470 L 231.5 474.5 L 236 476 L 231.5 477.5 L 230 482 L 228.5 477.5 L 224 476 L 228.5 474.5 Z"
            fill="#e0f2fe"
            style={{ animationDuration: '3.6s', animationDelay: '-1.0s' }}
          />
        </g>

        {/* Minimalist Shooting Stars Loop (along -32deg diagonal trajectory) */}
        <g id="shooting-stars">
          {/* Shooting Star 1 */}
          <g transform="translate(170, 48) rotate(-32) scale(0.9)">
            <g className="shooting-star" style={{ animationDuration: '4.5s', animationDelay: '-0.3s' }}>
              <line x1="0" y1="0" x2="160" y2="0" stroke="url(#shooting-trail-grad)" strokeWidth="2" strokeLinecap="round" />
              <line x1="0" y1="0" x2="56" y2="0" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
              <circle cx="0" cy="0" r="2.2" fill="#ffffff" />
              <path d="M -6 0 L 6 0 M 0 -6 L 0 6" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.75" />
            </g>
          </g>

          {/* Shooting Star 2 */}
          <g transform="translate(375, 88) rotate(-32) scale(1.05)">
            <g className="shooting-star" style={{ animationDuration: '5.6s', animationDelay: '-2.1s' }}>
              <line x1="0" y1="0" x2="190" y2="0" stroke="url(#shooting-trail-grad)" strokeWidth="2" strokeLinecap="round" />
              <line x1="0" y1="0" x2="65" y2="0" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
              <circle cx="0" cy="0" r="2.4" fill="#ffffff" />
              <path d="M -7 0 L 7 0 M 0 -7 L 0 7" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.75" />
            </g>
          </g>

          {/* Shooting Star 3 */}
          <g transform="translate(270, 175) rotate(-32) scale(0.85)">
            <g className="shooting-star" style={{ animationDuration: '4.2s', animationDelay: '-3.4s' }}>
              <line x1="0" y1="0" x2="150" y2="0" stroke="url(#shooting-trail-grad)" strokeWidth="2" strokeLinecap="round" />
              <line x1="0" y1="0" x2="52" y2="0" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
              <circle cx="0" cy="0" r="2.0" fill="#ffffff" />
              <path d="M -5 0 L 5 0 M 0 -5 L 0 5" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.75" />
            </g>
          </g>

          {/* Shooting Star 4 */}
          <g transform="translate(460, 235) rotate(-32) scale(0.95)">
            <g className="shooting-star" style={{ animationDuration: '5.0s', animationDelay: '-1.2s' }}>
              <line x1="0" y1="0" x2="175" y2="0" stroke="url(#shooting-trail-grad)" strokeWidth="2" strokeLinecap="round" />
              <line x1="0" y1="0" x2="60" y2="0" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
              <circle cx="0" cy="0" r="2.3" fill="#ffffff" />
              <path d="M -6 0 L 6 0 M 0 -6 L 0 6" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.75" />
            </g>
          </g>

          {/* Shooting Star 5 */}
          <g transform="translate(250, 395) rotate(-32) scale(0.9)">
            <g className="shooting-star" style={{ animationDuration: '4.8s', animationDelay: '-2.8s' }}>
              <line x1="0" y1="0" x2="160" y2="0" stroke="url(#shooting-trail-grad)" strokeWidth="2" strokeLinecap="round" />
              <line x1="0" y1="0" x2="55" y2="0" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
              <circle cx="0" cy="0" r="2.1" fill="#ffffff" />
              <path d="M -6 0 L 6 0 M 0 -6 L 0 6" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.75" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}
