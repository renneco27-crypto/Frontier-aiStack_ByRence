interface EnumerationSelfReportProps {
  onGotIt: () => void
  onMissedSome: () => void
}

export default function EnumerationSelfReport({ onGotIt, onMissedSome }: EnumerationSelfReportProps) {
  return (
    <div className="transition-all duration-300 opacity-100 translate-y-0">
      <hr className="border-[var(--color-border)] mb-3" />
      <p className="text-sm text-[var(--color-text-muted)] text-center mb-3">
        Did you recall all of them?
      </p>
      <div className="flex gap-3">
        <button
          onClick={onGotIt}
          className="flex-1 bg-[var(--color-know)] text-white rounded-xl py-3 font-medium hover:opacity-90 transition-opacity"
        >
          ✓ I got them all
        </button>
        <button
          onClick={onMissedSome}
          className="flex-1 border border-[var(--color-dontknow)] text-[var(--color-dontknow)] rounded-xl py-3 font-medium hover:bg-[var(--color-dontknow-soft)] transition-colors"
        >
          ✕ Missed some
        </button>
      </div>
    </div>
  )
}
