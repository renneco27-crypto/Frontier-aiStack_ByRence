'use client'

import { create } from 'zustand'
import type { Toast, ToastType } from '@/lib/zodSchemas'

interface ToastState {
  toasts: Toast[]
}

interface ToastActions {
  addToast: (message: string, type: ToastType) => void
  removeToast: (id: string) => void
}

function uuid(): string {
  return crypto.randomUUID()
}

export const useToastStore = create<ToastState & ToastActions>()((set) => ({
  toasts: [],

  addToast: (message, type) => {
    const id = uuid()
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }))
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
}))
