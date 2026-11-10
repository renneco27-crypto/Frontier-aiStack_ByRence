'use client'

import { create } from 'zustand'

export interface ProcessingJob {
  id: string
  fileName: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progressStep?: string
  deckId?: string
  createdAt: number
  completedAt?: number
  error?: string
}

interface ProcessingJobsState {
  jobs: ProcessingJob[]
  addJob: (job: ProcessingJob) => void
  updateJob: (id: string, updates: Partial<ProcessingJob>) => void
  removeJob: (id: string) => void
  clearCompleted: () => void
}

const STORAGE_KEY = 'studyup_processing_jobs'

function loadSavedJobs(): ProcessingJob[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistJobs(jobs: ProcessingJob[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(0, 30)))
  } catch {}
}

export const useProcessingJobsStore = create<ProcessingJobsState>()((set) => ({
  jobs: loadSavedJobs(),

  addJob: (job) =>
    set((state) => {
      const filtered = state.jobs.filter((j) => j.id !== job.id)
      const next = [job, ...filtered]
      persistJobs(next)
      return { jobs: next }
    }),

  updateJob: (id, updates) =>
    set((state) => {
      const next = state.jobs.map((j) => (j.id === id ? { ...j, ...updates, updatedAt: Date.now() } : j))
      persistJobs(next)
      return { jobs: next }
    }),

  removeJob: (id) =>
    set((state) => {
      const next = state.jobs.filter((j) => j.id !== id)
      persistJobs(next)
      return { jobs: next }
    }),

  clearCompleted: () =>
    set((state) => {
      const next = state.jobs.filter((j) => j.status === 'processing' || j.status === 'queued')
      persistJobs(next)
      return { jobs: next }
    }),
}))

// Direct dispatchers for non-React callers
export function registerJob(job: ProcessingJob) {
  useProcessingJobsStore.getState().addJob(job)
}

export function patchJob(id: string, updates: Partial<ProcessingJob>) {
  useProcessingJobsStore.getState().updateJob(id, updates)
}
