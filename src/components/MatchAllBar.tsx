'use client'

interface Props {
  unmatchedCount: number
  isLoading: boolean
  onMatchAll: () => void
}

export default function MatchAllBar({ unmatchedCount, isLoading, onMatchAll }: Props) {
  if (unmatchedCount === 0) return null

  return (
    <div className="sticky bottom-0 glass-dark border-t border-white/10 px-4 py-3 flex items-center justify-between z-10 safe-bottom">
      <p className="text-sm text-white/70">
        <span className="font-bold text-vc-purple-light">{unmatchedCount}</span>{' '}
        {unmatchedCount === 1 ? 'person' : 'people'} not yet matched
      </p>
      <button
        onClick={onMatchAll}
        disabled={isLoading}
        className="bg-vc-coral text-white px-6 py-2 rounded-btn text-sm font-bold hover:bg-vc-coral/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-glow-coral"
      >
        {isLoading ? (
          <>
            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            Matching...
          </>
        ) : (
          'Match All'
        )}
      </button>
    </div>
  )
}
