'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, Bell, Loader2, CheckCircle2, AlertCircle, Trash2, ArrowRight } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useProcessingJobsStore } from '@/store/processingJobsStore'
import { soundEngine } from '@/utils/soundEngine'

export default function NotificationPanel() {
  const router = useRouter()
  const { isNotificationPanelOpen, closeNotificationPanel, openUploadModal } = useUIStore()
  const { jobs, removeJob, clearCompleted } = useProcessingJobsStore()

  const [mounted, setMounted] = useState(false)
  const [slideIn, setSlideIn] = useState(false)

  useEffect(() => {
    if (isNotificationPanelOpen) {
      setMounted(true)
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setSlideIn(true))
      })
      return () => cancelAnimationFrame(frame)
    } else {
      setSlideIn(false)
      const timer = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isNotificationPanelOpen])

  const handleClose = useCallback(() => {
    soundEngine.play('thocky')
    setSlideIn(false)
    setTimeout(() => {
      closeNotificationPanel()
    }, 280)
  }, [closeNotificationPanel])

  if (!mounted && !isNotificationPanelOpen) return null

  const activeJobs = jobs.filter((j) => j.status === 'processing' || j.status === 'queued')
  const completedJobs = jobs.filter((j) => j.status === 'completed' || j.status === 'failed')

  return (
    <div
      id="notificationPanelOverlay"
      className={`fixed inset-0 z-50 flex justify-end max-w-[520px] mx-auto bg-black/60 transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        slideIn ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop click dismiss area */}
      <div onClick={handleClose} className="flex-1 h-full cursor-pointer" aria-hidden="true" />

      {/* Drill-in Panel from Right */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-[86%] sm:w-[80%] h-full bg-[#0b0c14] border-l border-[#1c1e2a] flex flex-col justify-between p-4 z-10 shadow-[-16px_0_40px_rgba(0,0,0,0.85)] transform transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          slideIn ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-[#1c1e2a] mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[10px] bg-[#9333ea]/15 text-[#c084fc] flex items-center justify-center">
                <Bell size={16} />
              </div>
              <div>
                <h3 className="text-[16px] font-extrabold text-white tracking-tight leading-tight">
                  Processing Decks
                </h3>
                <span className="text-[11px] font-semibold text-[#8e92a8]">
                  {activeJobs.length > 0 ? `${activeJobs.length} active synthesis` : 'AI Generation Queue'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center text-[#8e92a8] hover:text-white active:scale-90 transition cursor-pointer"
              title="Close Panel"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body / List */}
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
            {jobs.length === 0 ? (
              <div className="py-14 px-2 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#151722] border border-[#222536] flex items-center justify-center mx-auto text-[#8e92a8]">
                  <Bell size={20} />
                </div>
                <div>
                  <h4 className="text-[15px] font-extrabold text-white mb-1">No processing decks</h4>
                  <p className="text-[12.5px] text-[#8e92a8] leading-relaxed">
                    When you upload documents or notes for AI deck synthesis, their background download and generation progress will appear here.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('poppy')
                    handleClose()
                    openUploadModal('file')
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A78BFA] hover:text-[#c084fc] pt-1"
                >
                  <span>Upload a document</span>
                  <span>&rarr;</span>
                </button>
              </div>
            ) : (
              <>
                {/* Active Jobs */}
                {activeJobs.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#A78BFA] uppercase tracking-wider block px-1">
                      In Progress ({activeJobs.length})
                    </span>
                    <div className="space-y-2.5">
                      {activeJobs.map((job) => (
                        <div
                          key={job.id}
                          className="p-3.5 rounded-2xl bg-[#151722] border border-[#9333ea]/40 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[13.5px] font-bold text-white truncate flex-1">
                              {job.fileName}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#9333ea]/20 text-[#c084fc] text-[10px] font-extrabold uppercase shrink-0">
                              <Loader2 size={10} className="animate-spin" />
                              <span>AI Active</span>
                            </span>
                          </div>
                          <p className="text-[12px] text-[#8e92a8] leading-snug">
                            {job.progressStep || 'Synthesizing flashcards with Gemini...'}
                          </p>
                          <div className="w-full h-1.5 rounded-full bg-[#1c1e2a] overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#9333ea] to-[#c084fc] w-2/3 animate-pulse" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed / Past Jobs */}
                {completedJobs.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold text-[#8e92a8] uppercase tracking-wider">
                        Recent Decks
                      </span>
                      <button
                        type="button"
                        onClick={clearCompleted}
                        className="text-[11px] font-bold text-[#8e92a8] hover:text-white transition flex items-center gap-1"
                      >
                        <Trash2 size={11} />
                        <span>Clear</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {completedJobs.map((job) => {
                        const isDone = job.status === 'completed'
                        return (
                          <div
                            key={job.id}
                            className="p-3 rounded-2xl bg-[#151722] border border-[#222536] flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {isDone ? (
                                  <CheckCircle2 size={14} className="text-[#10B981] shrink-0" />
                                ) : (
                                  <AlertCircle size={14} className="text-[#EF4444] shrink-0" />
                                )}
                                <span className="text-[13px] font-bold text-white truncate">
                                  {job.fileName}
                                </span>
                              </div>
                              <span className="text-[11px] text-[#8e92a8] block mt-0.5 truncate">
                                {isDone ? 'Deck generated successfully' : job.error || 'Conversion failed'}
                              </span>
                            </div>

                            {isDone && job.deckId ? (
                              <button
                                type="button"
                                onClick={() => {
                                  soundEngine.play('thocky')
                                  handleClose()
                                  router.push('/study/' + job.deckId)
                                }}
                                className="h-7 px-2.5 rounded-[10px] bg-[#9333ea] text-white font-extrabold text-[11px] uppercase tracking-wide flex items-center gap-1 shrink-0 cursor-pointer hover:bg-[#a855f7] transition"
                              >
                                <span>Open</span>
                                <ArrowRight size={11} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => removeJob(job.id)}
                                className="p-1.5 text-[#8e92a8] hover:text-white"
                                title="Remove"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
