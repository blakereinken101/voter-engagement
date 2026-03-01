'use client'
import { useMemo } from 'react'
import { useAppContext } from '@/context/AppContext'
import RolodexCard from '@/components/RolodexCard'
import RelationalTopBar from '@/components/RelationalTopBar'
import MatchAllBar from '@/components/MatchAllBar'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function RolodexPage() {
  const { state, runMatchingForUnmatched } = useAppContext()

  const unmatchedCount = useMemo(() => {
    return state.actionPlanState.filter(item => {
      const { status, bestMatch } = item.matchResult
      return status === 'unmatched' || status === 'pending' || (!bestMatch && status !== 'confirmed')
    }).length
  }, [state.actionPlanState])

  if (state.actionPlanState.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center cosmic-bg constellation">
        <RelationalTopBar />
        <p className="text-white/50">
          No action plan yet.{' '}
          <Link href="/dashboard" className="text-vc-purple-light font-bold hover:underline">
            Build your list first
          </Link>.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen cosmic-bg constellation text-white flex flex-col">
      <RelationalTopBar />
      <header className="bg-gradient-to-r from-vc-purple-dark via-vc-purple to-vc-purple-light text-white px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="font-display text-xl font-extrabold tracking-tight">Action Plan</h1>
          <Link
            href="/dashboard"
            className="text-white/60 text-sm hover:text-white transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </Link>
        </div>
      </header>
      <div className="flex-1">
        <RolodexCard />
      </div>
      <MatchAllBar
        unmatchedCount={unmatchedCount}
        isLoading={state.isLoading}
        onMatchAll={runMatchingForUnmatched}
      />
    </div>
  )
}
