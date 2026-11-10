import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CreditsState {
  credits: number
  isPaidAccount: boolean
  addCreditsFromAd: () => void
  useCredits: (amount: number) => boolean
  setPaidAccount: (status: boolean) => void
}

export const useCreditsStore = create<CreditsState>()(
  persist(
    (set, get) => ({
      credits: 0,
      isPaidAccount: false,
      
      addCreditsFromAd: () => {
        set((state) => ({ credits: state.credits + 10 })) // 10 credits per ad
      },
      
      useCredits: (amount: number) => {
        const { credits, isPaidAccount } = get()
        if (isPaidAccount) return true // Paid accounts have unlimited or bypass
        
        if (credits >= amount) {
          set({ credits: credits - amount })
          return true
        }
        return false
      },
      
      setPaidAccount: (status: boolean) => set({ isPaidAccount: status }),
    }),
    {
      name: 'stitch-credits-storage',
    }
  )
)
