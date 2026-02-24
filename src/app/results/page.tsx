'use client'
import { useAppContext } from '@/context/AppContext'
import ResultsDashboard from '@/components/ResultsDashboard'
import RelationalTopBar from '@/components/RelationalTopBar'
import { segmentResults } from '@/lib/voter-segments'
import Link from 'next/link'

export default function ResultsPage() {
  const { state } = useAppContext()

  if (state.matchResults.length === 0) {
    return (
      <div className="min-h-screen flex flex-col cosmic-bg constellation">
        <RelationalTopBar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/50">No results yet. <Link href="/questionnaire" className="text-vc-purple-light font-bold hover:underline">Build your list first</Link>.</p>
        </div>
      </div>
    )
  }

  const segmented = segmentResults(state.matchResults)

  return (
    <div className="min-h-screen cosmic-bg constellation text-white">
      <RelationalTopBar />
      <ResultsDashboard segmented={segmented} />
    </div>
  )
}
