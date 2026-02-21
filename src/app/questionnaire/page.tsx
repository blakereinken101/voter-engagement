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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-vc-bg">
        <Link href="/" className="font-display font-extrabold text-vc-purple text-lg mb-12 hover:opacity-80 transition-opacity">
          VoteCircle
        </Link>
        <h1 className="font-display text-3xl md:text-4xl text-vc-slate font-extrabold mb-3 text-center tracking-tight">
          What state do you live in?
        </h1>
        <p className="text-vc-gray mb-8 text-center max-w-md">
          We will match your people against voter records for your state.
        </p>
        <StateSelector />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-vc-bg">
      <header className="bg-gradient-to-r from-vc-purple-dark via-vc-purple to-vc-purple-light text-white px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between mb-3">
          <Link href="/" className="font-display font-extrabold text-white text-sm hover:opacity-80 transition-opacity">
            VoteCircle
          </Link>
          <span className="text-white/40 text-sm">{state.personEntries.length} people</span>
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
