'use client'
import { useAppContext } from '@/context/AppContext'
import { CATEGORIES, IDEAL_PEOPLE_COUNT } from '@/lib/wizard-config'
import PersonInput from './PersonInput'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'

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

  return (
    <div className="animate-fade-in">
      {/* Category header */}
      <div className="mb-8">
        <div className="text-4xl mb-3">{currentConfig.icon}</div>
        <h2 className="font-display text-3xl text-rally-navy font-bold mb-2 leading-tight">
          {currentConfig.question}
        </h2>
        <p className="text-rally-slate-light text-base leading-relaxed">{currentConfig.subtext}</p>
      </div>

      {/* Examples */}
      <div className="flex flex-wrap gap-2 mb-6">
        {currentConfig.examples.map((ex, i) => (
          <span key={i} className="text-xs bg-rally-navy/5 text-rally-slate px-3 py-1.5 rounded-full">
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
          <p className="text-rally-yellow text-sm font-bold animate-slide-up">
            Keep going — try to add {currentConfig.minSuggested - peopleInCategory.length} more
          </p>
        )}
        {meetsMinimum && (
          <p className="text-rally-green text-sm font-bold animate-slide-up">
            {peopleInCategory.length} added from this group
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={handleBack}
          disabled={currentIndex === 0}
          className={clsx(
            'px-6 py-3 rounded-lg font-bold text-sm transition-colors',
            currentIndex === 0
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-rally-navy hover:bg-rally-navy/5'
          )}
        >
          Back
        </button>

        <div className="flex gap-3 items-center">
          {peopleInCategory.length === 0 && (
            <button
              onClick={handleNext}
              className="px-4 py-3 text-rally-slate-light text-sm hover:text-rally-navy transition-colors"
            >
              Skip
            </button>
          )}

          <button
            onClick={handleNext}
            className={clsx(
              'px-8 py-3 rounded-lg font-bold text-sm text-white transition-all',
              isLastCategory
                ? 'bg-rally-red hover:bg-rally-red-light shadow-lg shadow-rally-red/25'
                : 'bg-rally-navy hover:bg-rally-navy-light'
            )}
          >
            {isLastCategory ? 'Find My People' : 'Next'}
          </button>
        </div>
      </div>

      {/* Running total */}
      <div className="text-center mt-4">
        <span className="font-mono text-sm">
          <span className={clsx(
            'font-bold text-lg',
            totalPeople >= IDEAL_PEOPLE_COUNT ? 'text-rally-green' :
              totalPeople >= 30 ? 'text-rally-navy' : 'text-rally-slate-light'
          )}>
            {totalPeople}
          </span>
          <span className="text-rally-slate-light"> people in your circle</span>
          {totalPeople < 40 && totalPeople > 0 && (
            <span className="text-rally-slate-light"> — aim for {IDEAL_PEOPLE_COUNT}!</span>
          )}
        </span>
      </div>
    </div>
  )
}
