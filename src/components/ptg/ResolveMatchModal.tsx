'use client'

import { useState, useEffect } from 'react'
import type { MatchCandidate } from '@/types'
import { X, CheckCircle2, XCircle, Search, Loader2 } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  contactId: string
  onClose: () => void
  onResolved: () => void
}

interface CandidateData {
  contactName: string
  candidates: MatchCandidate[]
  currentStatus: string
}

export default function ResolveMatchModal({ contactId, onClose, onResolved }: Props) {
  const [data, setData] = useState<CandidateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/admin/ptg/conversations/${contactId}/candidates`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Failed to load candidates'))
      .finally(() => setLoading(false))
  }, [contactId])

  const handleConfirm = async (candidate: MatchCandidate) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/contacts/${contactId}/match`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          voterRecord: candidate.voterRecord,
          voteScore: candidate.score,
          segment: null,
          candidates: data?.candidates,
        }),
      })
      if (res.ok) onResolved()
      else setError('Failed to confirm match')
    } catch {
      setError('Failed to confirm match')
    } finally {
      setSaving(false)
    }
  }

  const handleReject = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/contacts/${contactId}/match`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      })
      if (res.ok) onResolved()
      else setError('Failed to reject match')
    } catch {
      setError('Failed to reject match')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card p-6 max-w-lg mx-4 w-full max-h-[80vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Search className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Resolve Match</h3>
              {data && <p className="text-xs text-white/40">{data.contactName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-vc-purple-light animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            {data.candidates.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-white/40 text-sm">No voter file matches found for this contact.</p>
                <button
                  onClick={handleReject}
                  disabled={saving}
                  className="mt-3 px-4 py-2 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors"
                >
                  Mark as Unmatched
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-white/40">
                  {data.candidates.length} potential match{data.candidates.length !== 1 ? 'es' : ''} found. Select the correct voter record:
                </p>

                {data.candidates.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">
                          {c.voterRecord.first_name} {c.voterRecord.last_name}
                        </p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {c.voterRecord.residential_address}, {c.voterRecord.city} {c.voterRecord.zip}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={clsx(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                            c.voterRecord.party_affiliation === 'DEM' && 'bg-blue-500/15 text-blue-300',
                            c.voterRecord.party_affiliation === 'REP' && 'bg-red-500/15 text-red-300',
                            !['DEM', 'REP'].includes(c.voterRecord.party_affiliation) && 'bg-white/5 text-white/40',
                          )}>
                            {c.voterRecord.party_affiliation}
                          </span>
                          <span className={clsx(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                            c.confidenceLevel === 'high' && 'bg-emerald-500/15 text-emerald-300',
                            c.confidenceLevel === 'medium' && 'bg-amber-500/15 text-amber-300',
                            c.confidenceLevel === 'low' && 'bg-orange-500/15 text-orange-300',
                            c.confidenceLevel === 'very-low' && 'bg-red-500/15 text-red-300',
                          )}>
                            {c.confidenceLevel} confidence
                          </span>
                          <span className="text-[10px] text-white/30">
                            Score: {Math.round(c.score * 100)}%
                          </span>
                        </div>
                        {c.matchedOn.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {c.matchedOn.map(field => (
                              <span key={field} className="text-[9px] text-white/30 bg-white/5 px-1 py-0.5 rounded">
                                {field}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleConfirm(c)}
                        disabled={saving}
                        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition-colors disabled:opacity-30"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Confirm
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleReject}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/[0.08] text-white/40 text-xs font-semibold hover:bg-white/[0.03] hover:text-white/60 transition-colors disabled:opacity-30"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  None of these — Mark as Unmatched
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
