'use client'
import { useAppContext } from '@/context/AppContext'
import RolodexCard from '@/components/RolodexCard'
import Link from 'next/link'

export default function RolodexPage() {
  const { state } = useAppContext()

  if (state.actionPlanState.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-rally-cream">
        <p className="text-rally-slate-light">
          No action plan yet.{' '}
          <Link href="/dashboard" className="text-rally-red font-bold hover:underline">
            Build your list first
          </Link>.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-rally-cream">
      <header className="bg-rally-navy text-white px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">Rolodex</h1>
          <Link
            href="/dashboard"
            className="text-white/60 text-sm hover:text-white transition-colors"
          >
            &larr; Dashboard
          </Link>
        </div>
      </header>
      <RolodexCard />
    </div>
  )
}
