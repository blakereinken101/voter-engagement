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
    <div className="min-h-screen cosmic-bg constellation py-12 px-6">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-white/40 text-sm font-display tabular-nums mb-2">
            {currentIndex + 1} of {ambiguousResults.length}
          </p>
          <h2 className="font-display text-2xl text-white font-bold">
            Which one is your {current.personEntry.firstName}?
          </h2>
          <p className="text-white/50 mt-2">
            You entered: <span className="font-bold text-vc-purple-light">{current.personEntry.firstName} {current.personEntry.lastName}</span>
            {current.personEntry.city && ` from ${current.personEntry.city}`}
          </p>
        </div>

        <div className="space-y-3">
          {current.candidates.map((candidate, i) => (
            <button
              key={i}
              onClick={() => handleConfirm(candidate.voterRecord)}
              className="w-full glass-card p-5 border-2 border-transparent hover:border-vc-purple transition-all text-left"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-lg text-white">{candidate.voterRecord.first_name} {candidate.voterRecord.last_name}</p>
                  <p className="text-white/50 text-sm">{candidate.voterRecord.residential_address}</p>
                  <p className="text-white/50 text-sm">{candidate.voterRecord.city}, {candidate.voterRecord.state} {candidate.voterRecord.zip}</p>
                  {candidate.voterRecord.birth_year && (
                    <p className="text-white/50 text-sm">Age {new Date().getFullYear() - parseInt(candidate.voterRecord.birth_year)}</p>
                  )}
                </div>
                <span className={`text-xs font-bold font-display tabular-nums px-3 py-1 rounded-full ${
                  candidate.confidenceLevel === 'high' ? 'bg-vc-teal/15 text-vc-teal border border-vc-teal/30' :
                    candidate.confidenceLevel === 'medium' ? 'bg-vc-gold/15 text-vc-gold border border-vc-gold/30' :
                      'bg-white/10 text-white/50'
                }`}>
                  {Math.round(candidate.score * 100)}%
                </span>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={handleReject}
          className="w-full mt-4 py-4 text-white/40 hover:text-white text-sm transition-colors border-2 border-dashed border-white/15 rounded-card hover:border-white/30"
        >
          None of these &mdash; skip this person
        </button>
      </div>
    </div>
  )
}
