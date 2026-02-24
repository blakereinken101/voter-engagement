'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppContext } from '@/context/AppContext'
import MatchConfirmation from '@/components/MatchConfirmation'
import RelationalTopBar from '@/components/RelationalTopBar'
import Link from 'next/link'

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
      <div className="min-h-screen flex flex-col cosmic-bg constellation">
        <RelationalTopBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-vc-purple border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h2 className="font-display text-2xl text-white font-bold mb-3">Searching the voter file...</h2>
            <p className="text-white/40 text-sm">{state.personEntries.length} people to match</p>
          </div>
        </div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="min-h-screen flex flex-col cosmic-bg constellation text-white">
        <RelationalTopBar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="glass-card p-8 max-w-md text-center">
            <h2 className="font-display text-xl font-bold text-red-300 mb-3">Something went wrong</h2>
            <p className="text-white/70 mb-6">{state.error}</p>
            <button
              onClick={() => runMatching()}
              className="bg-vc-purple text-white px-6 py-3 rounded-btn font-bold hover:bg-vc-purple-light transition-colors"
            >
              Try Again
            </button>
          </div>
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
    <div className="min-h-screen flex flex-col cosmic-bg constellation text-white">
      <RelationalTopBar />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-white/50">No people to match. <Link href="/questionnaire" className="text-vc-purple-light font-bold hover:underline">Go build your list</Link>.</p>
      </div>
    </div>
  )
}
