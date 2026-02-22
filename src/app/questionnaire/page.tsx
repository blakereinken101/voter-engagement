'use client'
import { useAppContext } from '@/context/AppContext'
import StateSelector from '@/components/StateSelector'
import CategoryWizard from '@/components/CategoryWizard'
import ProgressBar from '@/components/ProgressBar'
import { CATEGORIES } from '@/lib/wizard-config'
import Link from 'next/link'
import Image from 'next/image'

export default function QuestionnairePage() {
  const { state } = useAppContext()
  const wizardStep = state.currentCategoryIndex + 1

  if (!state.selectedState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 cosmic-bg constellation">
        <Link href="/" className="inline-block mb-12 hover:opacity-80 transition-opacity">
          <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-48 md:h-64 w-auto" priority />
        </Link>
        <h1 className="font-display text-3xl md:text-4xl text-white font-extrabold mb-3 text-center tracking-tight">
          What state do you live in?
        </h1>
        <p className="text-white/50 mb-8 text-center max-w-md">
          We will match your people against voter records for your state.
        </p>
        <StateSelector />
      </div>
    )
  }

  return (
    <div className="min-h-screen cosmic-bg constellation text-white">
      <header className="bg-gradient-to-r from-vc-purple-dark via-vc-purple to-vc-purple-light text-white px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between mb-3">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-20 md:h-28 w-auto" />
          </Link>
          <span className="text-white/40 text-sm">{state.personEntries.length} people</span>
        </div>
        <div className="max-w-2xl mx-auto">
          <ProgressBar current={wizardStep} total={CATEGORIES.length} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="glass-card p-6 md:p-8 text-white">
          <CategoryWizard />
        </div>
      </main>
    </div>
  )
}
