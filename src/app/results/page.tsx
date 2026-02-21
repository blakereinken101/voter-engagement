'use client'
import { useAppContext } from '@/context/AppContext'
import ResultsDashboard from '@/components/ResultsDashboard'
import { segmentResults } from '@/lib/voter-segments'
import Link from 'next/link'

export default function ResultsPage() {
  const { state } = useAppContext()

  if (state.matchResults.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center cosmic-bg constellation">
        <p className="text-white/50">No results yet. <Link href="/questionnaire" className="text-vc-purple-light font-bold hover:underline">Build your list first</Link>.</p>
      </div>
    )
  }

  const segmented = segmentResults(state.matchResults)

  return (
    <div className="min-h-screen cosmic-bg constellation text-white">
      <ResultsDashboard segmented={segmented} />
    </div>
  )
}
