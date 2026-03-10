'use client'
import { useState } from 'react'
import { PersonEntry, MatchResult, SafeVoterRecord } from '@/types'
import { getRegistrationUrl } from '../VoterRegistrationLinks'
import { useAuth } from '@/context/AuthContext'
import defaultCampaignConfig from '@/lib/campaign-config'
import { Share2, Check, Search, Loader2 } from 'lucide-react'

interface Props {
  person: PersonEntry
  matchResult?: MatchResult
  onConfirmMatch: (personId: string, voterRecord: SafeVoterRecord) => void
  onRejectMatch: (personId: string) => void
  onRematch?: (personId: string) => void
}

export default function MatchStatusBadge({ person, matchResult, onConfirmMatch, onRejectMatch, onRematch }: Props) {
  const { campaignConfig: authConfig } = useAuth()
  const campaignConfig = authConfig || defaultCampaignConfig
  const [showCandidates, setShowCandidates] = useState(false)
  const [regLinkSent, setRegLinkSent] = useState(false)
  const [rematching, setRematching] = useState(false)

  const status = matchResult?.status

  if (!matchResult) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-white/50 bg-white/10 px-2 py-0.5 rounded-full">Not matched yet</span>
        {onRematch && (
          <button
            onClick={async () => { setRematching(true); await onRematch(person.id); setRematching(false) }}
            disabled={rematching}
            className="text-[10px] font-bold text-vc-purple-light bg-vc-purple/10 px-2 py-0.5 rounded-full hover:bg-vc-purple/20 transition-colors inline-flex items-center gap-1"
          >
            {rematching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            Search matches
          </button>
        )}
      </div>
    )
  }

  if (status === 'confirmed') {
    return <span className="text-[10px] font-bold text-vc-teal bg-vc-teal/10 px-2 py-0.5 rounded-full">Matched</span>
  }

  if (status === 'unmatched') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold text-white/60 bg-white/10 px-2 py-0.5 rounded-full">No match</span>
        {onRematch && (
          <button
            onClick={async () => { setRematching(true); await onRematch(person.id); setRematching(false) }}
            disabled={rematching}
            className="text-[10px] font-bold text-vc-purple-light bg-vc-purple/10 px-2 py-0.5 rounded-full hover:bg-vc-purple/20 transition-colors inline-flex items-center gap-1"
          >
            {rematching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            Search again
          </button>
        )}
        {!regLinkSent ? (
          <button
            onClick={async () => {
              const regUrl = getRegistrationUrl(campaignConfig.state)
              const text = `Hey ${person.firstName}, make sure you're registered to vote! Check here: ${regUrl}`
              if (navigator.share) {
                try {
                  await navigator.share({ text })
                  setRegLinkSent(true)
                } catch { /* user cancelled share */ }
              } else {
                await navigator.clipboard.writeText(text)
                setRegLinkSent(true)
              }
            }}
            className="text-[10px] font-bold text-vc-teal bg-vc-teal/10 px-2 py-0.5 rounded-full hover:bg-vc-teal/20 transition-colors inline-flex items-center gap-1"
          >
            <Share2 className="w-3 h-3" />
            Send Reg Link
          </button>
        ) : (
          <span className="text-[10px] font-bold text-vc-teal bg-vc-teal/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <Check className="w-3 h-3" />
            Reg link sent
          </span>
        )}
      </div>
    )
  }

  if (status === 'ambiguous') {
    return (
      <div className="relative" style={{ zIndex: showCandidates ? 50 : 'auto' }}>
        <button
          onClick={() => setShowCandidates(!showCandidates)}
          className="text-[10px] font-bold text-vc-gold bg-vc-gold/20 px-2 py-0.5 rounded-full hover:bg-vc-gold/30 transition-colors"
        >
          Pick match ▾
        </button>
        {showCandidates && matchResult?.candidates && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowCandidates(false)} />
            <div className="absolute z-50 top-full mt-1 left-0 glass-card bg-vc-surface/95 backdrop-blur-xl p-2 min-w-[280px] shadow-xl border border-white/20 rounded-lg">
              {matchResult.candidates.map((c, i) => {
                const age = c.voterRecord.birth_year ? new Date().getFullYear() - parseInt(c.voterRecord.birth_year) : null
                return (
                  <button
                    key={i}
                    onClick={() => { onConfirmMatch(person.id, c.voterRecord); setShowCandidates(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 rounded transition-colors"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold text-white">{c.voterRecord.first_name} {c.voterRecord.last_name}</span>
                      <span className="text-white/40 font-display tabular-nums ml-2">{Math.round(c.score * 100)}%</span>
                    </div>
                    <div className="text-white/40 mt-0.5">
                      {c.voterRecord.residential_address}, {c.voterRecord.city}
                      {age && <span className="ml-1">&middot; Age {age}</span>}
                    </div>
                  </button>
                )
              })}
              <button
                onClick={() => { onRejectMatch(person.id); setShowCandidates(false) }}
                className="w-full text-left px-3 py-2 text-xs text-vc-coral hover:bg-vc-coral/5 rounded transition-colors font-bold"
              >
                None of these
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return null
}
