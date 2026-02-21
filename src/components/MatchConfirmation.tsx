'use client'
import { useState } from 'react'
import { useAppContext } from '@/context/AppContext'
import { MatchResult, SafeVoterRecord } from '@/types'
import { useRouter } from 'next/navigation'

interface Props {
  ambiguousResults: MatchResult[]
}

export default function MatchConfirmation({ ambiguousResults }: Props) {
  const { confirmMatch, rejectMatch } = useAppContext()
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)

  const current = ambiguousResults[currentIndex]
  const isLast = currentIndex === ambiguousResults.length - 1

  function handleConfirm(voterRecord: SafeVoterRecord) {
    confirmMatch(current.personEntry.id, voterRecord)
    advance()
  }

  function handleReject() {
    rejectMatch(current.personEntry.id)
    advance()
  }

  function advance() {
    if (isLast) {
      router.push('/results')
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  if (!current) return null

  return (
    <div className="min-h-screen bg-rally-cream py-12 px-6">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-rally-slate-light text-sm font-mono mb-2">
            {currentIndex + 1} of {ambiguousResults.length}
          </p>
          <h2 className="font-display text-2xl text-rally-navy font-bold">
            Which one is your {current.personEntry.firstName}?
          </h2>
          <p className="text-rally-slate-light mt-2">
            You entered: <span className="font-bold text-rally-navy">{current.personEntry.firstName} {current.personEntry.lastName}</span>
            {current.personEntry.city && ` from ${current.personEntry.city}`}
          </p>
        </div>

        <div className="space-y-3">
          {current.candidates.map((candidate, i) => (
            <button
              key={i}
              onClick={() => handleConfirm(candidate.voterRecord)}
              className="w-full bg-white rounded-xl p-5 border-2 border-transparent hover:border-rally-red transition-all text-left shadow-sm"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-lg text-rally-navy">{candidate.voterRecord.first_name} {candidate.voterRecord.last_name}</p>
                  <p className="text-rally-slate-light text-sm">{candidate.voterRecord.residential_address}</p>
                  <p className="text-rally-slate-light text-sm">{candidate.voterRecord.city}, {candidate.voterRecord.state} {candidate.voterRecord.zip}</p>
                  {candidate.voterRecord.birth_year && (
                    <p className="text-rally-slate-light text-sm">Age {new Date().getFullYear() - parseInt(candidate.voterRecord.birth_year)}</p>
                  )}
                </div>
                <span className={`text-xs font-bold font-mono px-3 py-1 rounded-full ${
                  candidate.confidenceLevel === 'high' ? 'bg-rally-green/10 text-rally-green' :
                    candidate.confidenceLevel === 'medium' ? 'bg-rally-yellow/20 text-rally-slate' :
                      'bg-gray-100 text-rally-slate-light'
                }`}>
                  {Math.round(candidate.score * 100)}%
                </span>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={handleReject}
          className="w-full mt-4 py-4 text-rally-slate-light hover:text-rally-navy text-sm transition-colors border-2 border-dashed border-gray-200 rounded-xl hover:border-gray-400"
        >
          None of these — skip this person
        </button>
      </div>
    </div>
  )
}
