'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Info,
  AlertTriangle,
  X,
} from 'lucide-react'
import type { Toast as ToastType } from '@/lib/zodSchemas'
import { TOAST_DURATION_MS } from '@/lib/constants'

const typeConfig = {
  success: { border: 'var(--color-know)', icon: CheckCircle2, iconColor: 'var(--color-know)' },
  error: { border: 'var(--color-dontknow)', icon: XCircle, iconColor: 'var(--color-dontknow)' },
  info: { border: 'var(--color-accent)', icon: Info, iconColor: 'var(--color-accent)' },
  warning: { border: 'var(--color-mastered)', icon: AlertTriangle, iconColor: 'var(--color-mastered)' },
}

interface ToastProps {
  toast: ToastType
  onDismiss: (id: string) => void
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true)
      setTimeout(() => onDismiss(toast.id), 200)
    }, TOAST_DURATION_MS)
    return () => clearTimeout(timerRef.current)
  }, [toast.id, onDismiss])

  const config = typeConfig[toast.type]
  const Icon = config.icon

  return (
    <div
      className={`max-w-xs rounded-xl border-l-4 p-4 shadow-lg flex items-start gap-3 bg-[#151722] transition-transform duration-200 ease-in-out ${
        exiting ? 'translate-x-[120%]' : 'translate-x-0'
      }`}
      style={{ borderColor: config.border }}
    >
      <Icon size={18} style={{ color: config.iconColor }} className="flex-shrink-0 mt-0.5" />
      <p className="text-sm text-[var(--color-text-primary)] flex-1">{toast.message}</p>
      <button
        onClick={() => {
          setExiting(true)
          setTimeout(() => onDismiss(toast.id), 200)
        }}
        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}
