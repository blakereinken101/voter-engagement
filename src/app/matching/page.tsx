'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppContext } from '@/context/AppContext'
import MatchConfirmation from '@/components/MatchConfirmation'

export default function MatchingPage() {
  const { state, runMatching } = useAppContext()
  const router = useRouter()

  useEffect(() => {
    if (state.matchResults.length === 0 && !state.isLoading && state.personEntries.length > 0 && !state.error) {
      runMatching()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (state.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-rally-navy">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-rally-red border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="font-display text-2xl text-white font-bold mb-3">Searching the voter file...</h2>
          <p className="text-white/40 font-mono">{state.personEntries.length} people to match</p>
        </div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-rally-cream">
        <div className="bg-white border border-rally-red/20 rounded-xl p-8 max-w-md text-center shadow-lg">
          <h2 className="font-display text-xl font-bold text-rally-red mb-3">Something went wrong</h2>
          <p className="text-rally-slate-light mb-6">{state.error}</p>
          <button
            onClick={() => runMatching()}
            className="bg-rally-navy text-white px-6 py-3 rounded-lg font-bold hover:bg-rally-navy-light transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (state.matchResults.length > 0) {
    const ambiguous = state.matchResults.filter(r => r.status === 'ambiguous')

    if (ambiguous.length > 0) {
      return <MatchConfirmation ambiguousResults={ambiguous} />
    }

    // All resolved — go to results
    router.push('/results')
    return null
  }

  // No results yet and not loading — redirect to questionnaire
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-rally-cream">
      <p className="text-rally-slate-light">No people to match. <a href="/questionnaire" className="text-rally-red font-bold hover:underline">Go build your list</a>.</p>
    </div>
  )
}
