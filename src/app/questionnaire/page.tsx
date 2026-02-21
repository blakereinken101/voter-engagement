'use client'
import { useAppContext } from '@/context/AppContext'
import StateSelector from '@/components/StateSelector'
import CategoryWizard from '@/components/CategoryWizard'
import ProgressBar from '@/components/ProgressBar'
import { CATEGORIES } from '@/lib/wizard-config'
import Link from 'next/link'

export default function QuestionnairePage() {
  const { state } = useAppContext()
  const wizardStep = state.currentCategoryIndex + 1

  if (!state.selectedState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Link href="/" className="font-display font-bold text-rally-navy text-lg mb-12 hover:text-rally-red transition-colors">
          VoteCircle
        </Link>
        <h1 className="font-display text-3xl md:text-4xl text-rally-navy font-bold mb-3 text-center">
          What state do you live in?
        </h1>
        <p className="text-rally-slate-light mb-8 text-center max-w-md">
          We will match your people against voter records for your state.
        </p>
        <StateSelector />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-rally-cream">
      <header className="bg-rally-navy text-white px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between mb-3">
          <Link href="/" className="font-display font-bold text-white text-sm hover:text-rally-yellow transition-colors">
            VoteCircle
          </Link>
          <span className="text-white/40 text-sm font-mono">{state.personEntries.length} people</span>
        </div>
        <div className="max-w-2xl mx-auto">
          <ProgressBar current={wizardStep} total={CATEGORIES.length} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <CategoryWizard />
      </main>
    </div>
  )
}
