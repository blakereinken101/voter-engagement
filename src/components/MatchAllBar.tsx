'use client'

interface Props {
  unmatchedCount: number
  isLoading: boolean
  onMatchAll: () => void
}

export default function MatchAllBar({ unmatchedCount, isLoading, onMatchAll }: Props) {
  if (unmatchedCount === 0) return null

  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg flex items-center justify-between z-10">
      <p className="text-sm text-rally-slate">
        <span className="font-bold text-rally-navy">{unmatchedCount}</span>{' '}
        {unmatchedCount === 1 ? 'person' : 'people'} not yet matched
      </p>
      <button
        onClick={onMatchAll}
        disabled={isLoading}
        className="bg-rally-red text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-rally-red-light transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
