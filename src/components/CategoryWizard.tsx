'use client'
import { useAppContext } from '@/context/AppContext'
import { CATEGORIES, IDEAL_PEOPLE_COUNT } from '@/lib/wizard-config'
import PersonInput from './PersonInput'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import {
  Home,
  Heart,
  Users,
  Star,
  PartyPopper,
  Building,
  Briefcase,
  Landmark,
  GraduationCap,
  Trophy,
  BookOpen,
  Coffee,
  Utensils,
  Search,
  type LucideIcon,
} from 'lucide-react'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'home': Home,
  'heart': Heart,
  'users': Users,
  'star': Star,
  'party-popper': PartyPopper,
  'building': Building,
  'briefcase': Briefcase,
  'landmark': Landmark,
  'graduation-cap': GraduationCap,
  'trophy': Trophy,
  'book-open': BookOpen,
  'coffee': Coffee,
  'utensils': Utensils,
  'search': Search,
}

export default function CategoryWizard() {
  const { state, dispatch, runMatching } = useAppContext()
  const router = useRouter()

  const currentIndex = state.currentCategoryIndex
  const currentConfig = CATEGORIES[currentIndex]
  const peopleInCategory = state.personEntries.filter(p => p.category === currentConfig.id)
  const isLastCategory = currentIndex === CATEGORIES.length - 1

  function handleNext() {
    if (isLastCategory) {
      handleFinish()
      return
    }
    dispatch({ type: 'SET_CATEGORY_INDEX', payload: currentIndex + 1 })
  }

  function handleBack() {
    if (currentIndex > 0) {
      dispatch({ type: 'SET_CATEGORY_INDEX', payload: currentIndex - 1 })
    }
  }

  async function handleFinish() {
    dispatch({ type: 'SET_STEP', payload: 'matching' })
    router.push('/matching')
  }

  const meetsMinimum = peopleInCategory.length >= currentConfig.minSuggested
  const totalPeople = state.personEntries.length

  const IconComponent = CATEGORY_ICONS[currentConfig.icon]

  return (
    <div className="animate-fade-in">
      {/* Category header */}
      <div className="mb-8">
        {IconComponent && (
          <div className="mb-3">
            <IconComponent className="w-10 h-10 text-vc-purple-light" strokeWidth={1.5} />
          </div>
        )}
        <h2 className="font-display text-3xl text-white font-bold mb-2 leading-tight">
          {currentConfig.question}
        </h2>
        <p className="text-white/50 text-base leading-relaxed">{currentConfig.subtext}</p>
      </div>

      {/* Examples */}
      <div className="flex flex-wrap gap-2 mb-6">
        {currentConfig.examples.map((ex, i) => (
          <span key={i} className="text-xs bg-white/10 text-white/70 px-3 py-1.5 rounded-full">
            {ex}
          </span>
        ))}
      </div>

      {/* People added for this category */}
      {peopleInCategory.length > 0 && (
        <div className="space-y-2 mb-4">
          {peopleInCategory.map(person => (
            <PersonInput key={person.id} person={person} category={currentConfig.id} mode="edit" />
          ))}
        </div>
      )}

      {/* Add person form */}
      <PersonInput category={currentConfig.id} mode="add" />

      {/* Encouragement */}
      <div className="mt-4 text-center">
        {peopleInCategory.length > 0 && !meetsMinimum && (
          <p className="text-vc-gold text-sm font-bold animate-slide-up">
            Keep going — try to add {currentConfig.minSuggested - peopleInCategory.length} more
          </p>
        )}
        {meetsMinimum && (
          <p className="text-vc-teal text-sm font-bold animate-slide-up">
            {peopleInCategory.length} added from this group
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/10">
        <button
          onClick={handleBack}
          disabled={currentIndex === 0}
          className={clsx(
            'px-6 py-3 rounded-btn font-bold text-sm transition-colors',
            currentIndex === 0
              ? 'text-white/20 cursor-not-allowed'
              : 'text-vc-purple-light hover:bg-white/10'
          )}
        >
          Back
        </button>

        <div className="flex gap-3 items-center">
          {peopleInCategory.length === 0 && (
            <button
              onClick={handleNext}
              className="px-4 py-3 text-white/40 text-sm hover:text-white transition-colors"
            >
              Skip
            </button>
          )}

          <button
            onClick={handleNext}
            className={clsx(
              'px-8 py-3 rounded-btn font-bold text-sm text-white transition-all',
              isLastCategory
                ? 'bg-vc-coral hover:bg-vc-coral/80 shadow-glow-coral'
                : 'bg-vc-purple hover:bg-vc-purple-light shadow-glow'
            )}
          >
            {isLastCategory ? 'Find My People' : 'Next'}
          </button>
        </div>
      </div>

      {/* Running total */}
      <div className="text-center mt-4">
        <span className="font-display text-sm">
          <span className={clsx(
            'font-bold text-lg',
            totalPeople >= IDEAL_PEOPLE_COUNT ? 'text-vc-teal' :
              totalPeople >= 30 ? 'text-vc-purple-light' : 'text-white/40'
          )}>
            {totalPeople}
          </span>
          <span className="text-white/40"> people in your circle</span>
          {totalPeople < 40 && totalPeople > 0 && (
            <span className="text-white/40"> — aim for {IDEAL_PEOPLE_COUNT}!</span>
          )}
        </span>
      </div>
    </div>
  )
}
