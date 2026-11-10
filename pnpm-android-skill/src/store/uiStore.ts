'use client'

import { create } from 'zustand'
import { soundEngine } from '@/utils/soundEngine'

type UploadTab = 'file' | 'text' | 'notes'

interface UIState {
  isUploadModalOpen: boolean
  uploadModalTab: UploadTab
  isDrawerOpen: boolean
  isSettingsModalOpen: boolean
  isNotificationPanelOpen: boolean
  selectedDeckId: string | null
}

interface UIActions {
  openUploadModal: (tab?: UploadTab) => void
  closeUploadModal: () => void
  setUploadModalTab: (tab: UploadTab) => void
  openDrawer: () => void
  closeDrawer: () => void
  openSettingsModal: () => void
  closeSettingsModal: () => void
  openNotificationPanel: () => void
  closeNotificationPanel: () => void
  setSelectedDeckId: (deckId: string | null) => void
}

export const useUIStore = create<UIState & UIActions>()((set) => ({
  isUploadModalOpen: false,
  uploadModalTab: 'text',
  isDrawerOpen: false,
  isSettingsModalOpen: false,
  isNotificationPanelOpen: false,
  selectedDeckId: null,

  openUploadModal: (tab = 'file') => {
    soundEngine.playBrush(0.5)
    set({ isUploadModalOpen: true, uploadModalTab: tab })
  },

  closeUploadModal: () => {
    soundEngine.playBrush(0.5)
    set({ isUploadModalOpen: false })
  },

  setUploadModalTab: (tab) => set({ uploadModalTab: tab }),

  openDrawer: () => {
    soundEngine.playBrush(0.5)
    set({ isDrawerOpen: true })
  },
  closeDrawer: () => {
    soundEngine.playBrush(0.5)
    set({ isDrawerOpen: false })
  },

  openSettingsModal: () => {
    soundEngine.playBrush(0.5)
    set({ isSettingsModalOpen: true, isDrawerOpen: false })
  },
  closeSettingsModal: () => {
    soundEngine.playBrush(0.5)
    set({ isSettingsModalOpen: false })
  },

  openNotificationPanel: () => {
    soundEngine.playBrush(0.5)
    set({ isNotificationPanelOpen: true, isDrawerOpen: false, isSettingsModalOpen: false })
  },
  closeNotificationPanel: () => {
    soundEngine.playBrush(0.5)
    set({ isNotificationPanelOpen: false })
  },

  setSelectedDeckId: (deckId) => set({ selectedDeckId: deckId }),
}))
