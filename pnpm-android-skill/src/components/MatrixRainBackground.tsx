'use client'

import { useEffect, useRef } from 'react'

interface MatrixRainBackgroundProps {
  opacity?: number
  speedMultiplier?: number
  maxStreams?: number
}

export default function MatrixRainBackground({
  opacity = 0.35,
  speedMultiplier = 0.4,
  maxStreams = 10,
}: MatrixRainBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
      initDrops()
    }
    window.addEventListener('resize', handleResize)

    // Cyber / Matrix Glyphs
    const chars = '0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜΣΩλπψ§∆∇'
    const fontSize = 15

    interface Drop {
      columnIndex: number
      y: number
      speed: number
      length: number
      chars: string[]
    }

    let drops: Drop[] = []

    const initDrops = () => {
      const totalColumns = Math.max(1, Math.floor(width / fontSize))
      drops = []
      for (let i = 0; i < maxStreams; i++) {
        const length = Math.floor(Math.random() * 14) + 8
        const charArr: string[] = []
        for (let j = 0; j < length; j++) {
          charArr.push(chars[Math.floor(Math.random() * chars.length)])
        }
        // Distribute columns evenly with slight randomness
        const baseCol = Math.floor((i / maxStreams) * totalColumns)
        const col = Math.min(
          totalColumns - 1,
          Math.max(0, baseCol + Math.floor(Math.random() * 5 - 2))
        )

        drops.push({
          columnIndex: col,
          y: Math.random() * -height,
          speed: (Math.random() * 1.0 + 0.8) * speedMultiplier,
          length,
          chars: charArr,
        })
      }
    }

    initDrops()

    let lastTime = performance.now()
    const fpsInterval = 1000 / 35 // Smooth 35 FPS

    const render = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(render)

      const elapsed = currentTime - lastTime
      if (elapsed < fpsInterval) return
      lastTime = currentTime - (elapsed % fpsInterval)

      ctx.clearRect(0, 0, width, height)
      ctx.font = `${fontSize}px monospace`

      const totalColumns = Math.max(1, Math.floor(width / fontSize))

      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i]
        const x = drop.columnIndex * fontSize

        for (let j = 0; j < drop.length; j++) {
          const charY = drop.y - j * fontSize
          if (charY < -fontSize || charY > height + fontSize) continue

          // Random character mutation
          if (Math.random() < 0.02) {
            drop.chars[j] = chars[Math.floor(Math.random() * chars.length)]
          }

          if (j === 0) {
            // Bright leading head
            ctx.fillStyle = '#f5d0fe'
          } else if (j === 1) {
            // Bright neon purple
            ctx.fillStyle = '#c084fc'
          } else {
            // Fading purple trail
            const trailAlpha = 1 - j / drop.length
            ctx.fillStyle = `rgba(168, 85, 247, ${trailAlpha * 0.75})`
          }

          ctx.fillText(drop.chars[j] || '0', x, charY)
        }

        // Advance drop
        drop.y += drop.speed * (fontSize * 0.5)

        // Reset drop when tail passes bottom to a new random column
        if (drop.y - drop.length * fontSize > height) {
          drop.y = -Math.random() * 80
          drop.columnIndex = Math.floor(Math.random() * totalColumns)
          drop.speed = (Math.random() * 1.0 + 0.8) * speedMultiplier
          drop.length = Math.floor(Math.random() * 14) + 8
        }
      }
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [speedMultiplier, maxStreams])

  return (
    <canvas
      ref={canvasRef}
      style={{ opacity }}
      className="fixed inset-0 w-full h-full pointer-events-none -z-10"
    />
  )
}
