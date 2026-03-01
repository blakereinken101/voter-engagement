'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileSignature, ChevronDown, ChevronRight, Check, X, HelpCircle, Loader2, AlertTriangle, Users, ArrowRightLeft } from 'lucide-react'

// =============================================
// TYPES
// =============================================

interface MatchCandidateData {
  voterRecord: {
    first_name: string
    last_name: string
    residential_address: string
    city: string
    state: string
    zip: string
    party_affiliation: string
    voter_status: string
    birth_year?: string
    registration_date?: string
  }
  score: number
  confidenceLevel: string
  matchedOn: string[]
}

interface PetitionSignatureRow {
  id: string
  line_number: number | null
  first_name: string
  last_name: string
  address: string | null
  city: string | null
  zip: string | null
  date_signed: string | null
  match_status: string
  match_score: number | null
  match_data: string | null
  candidates_data: string | null
  user_confirmed: boolean
}

interface PetitionSheet {
  id: string
  petitioner_name: string | null
  petitioner_canonical_name: string | null
  petitioner_id: string | null
  scanned_by_name: string
  total_signatures: number
  matched_count: number
  validity_rate: number
  status: string
  is_duplicate: boolean
  duplicate_of: string | null
  created_at: string
  signature_count: string
}

interface PetitionStats {
  total_sheets: string
  total_signatures: string
  total_matched: string
  overall_validity_rate: string
}

interface PetitionerData {
  id: string
  canonical_name: string
  name_variants: string
  total_sheets: number
  total_signatures: number
  matched_count: number
  validity_rate: number
  sheets_count: string
  total_sigs: string
  total_matched: string
  sheets: PetitionSheet[]
}

// =============================================
// COMPONENT
// =============================================

export default function PetitionDashboard() {
  const [sheets, setSheets] = useState<PetitionSheet[]>([])
  const [stats, setStats] = useState<PetitionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedSheet, setExpandedSheet] = useState<string | null>(null)
  const [sheetSignatures, setSheetSignatures] = useState<Record<string, PetitionSignatureRow[]>>({})
  const [loadingSigs, setLoadingSigs] = useState<string | null>(null)

  // Petitioner view state
  const [viewMode, setViewMode] = useState<'sheets' | 'petitioners'>('sheets')
  const [petitioners, setPetitioners] = useState<PetitionerData[]>([])
  const [loadingPetitioners, setLoadingPetitioners] = useState(false)
  const [expandedPetitioner, setExpandedPetitioner] = useState<string | null>(null)

  // Candidate picker state
  const [pickerSigId, setPickerSigId] = useState<string | null>(null)
  const [savingOverride, setSavingOverride] = useState(false)

  const fetchSheets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/petitions')
      if (!res.ok) return
      const data = await res.json()
      setSheets(data.sheets || [])
      setStats(data.stats || null)
    } catch (err) {
      console.error('[petitions] Error loading:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSheets() }, [fetchSheets])

  const fetchPetitioners = useCallback(async () => {
    setLoadingPetitioners(true)
    try {
      const res = await fetch('/api/admin/petitions/petitioners')
      if (!res.ok) return
      const data = await res.json()
      setPetitioners(data.petitioners || [])
    } catch (err) {
      console.error('[petitions] Error loading petitioners:', err)
    } finally {
      setLoadingPetitioners(false)
    }
  }, [])

  useEffect(() => {
    if (viewMode === 'petitioners') {
      fetchPetitioners()
    }
  }, [viewMode, fetchPetitioners])

  const toggleSheet = useCallback(async (sheetId: string) => {
    if (expandedSheet === sheetId) {
      setExpandedSheet(null)
      setPickerSigId(null)
      return
    }
    setExpandedSheet(sheetId)
    setPickerSigId(null)

    if (!sheetSignatures[sheetId]) {
      setLoadingSigs(sheetId)
      try {
        const res = await fetch(`/api/admin/petitions?sheetId=${sheetId}`)
        if (res.ok) {
          const data = await res.json()
          setSheetSignatures(prev => ({ ...prev, [sheetId]: data.signatures || [] }))
        }
      } catch {
        console.error('[petitions] Error loading signatures')
      } finally {
        setLoadingSigs(null)
      }
    }
  }, [expandedSheet, sheetSignatures])

  // Handle selecting a different match candidate
  const handleMatchOverride = useCallback(async (sheetId: string, sigId: string, candidateIndex: number | null) => {
    setSavingOverride(true)
    try {
      const body = candidateIndex === null
        ? { matchStatus: 'unmatched' as const }
        : { candidateIndex }

      const res = await fetch(`/api/admin/petitions/${sheetId}/signatures/${sigId}/match`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        // Reload signatures for this sheet
        const sigsRes = await fetch(`/api/admin/petitions?sheetId=${sheetId}`)
        if (sigsRes.ok) {
          const data = await sigsRes.json()
          setSheetSignatures(prev => ({ ...prev, [sheetId]: data.signatures || [] }))
        }
        // Reload sheet list to update validity rates
        fetchSheets()
        setPickerSigId(null)
      }
    } catch (err) {
      console.error('[petitions] Error overriding match:', err)
    } finally {
      setSavingOverride(false)
    }
  }, [fetchSheets])

  // =============================================
  // MATCH STATUS HELPERS
  // =============================================

  const matchStatusLabel = (status: string, score: number | null, confirmed: boolean) => {
    if (confirmed && status === 'matched') {
      return { label: 'Confirmed', color: 'text-emerald-400', icon: <Check className="w-3.5 h-3.5" /> }
    }
    if (confirmed && status === 'unmatched') {
      return { label: 'No Match', color: 'text-red-400', icon: <X className="w-3.5 h-3.5" /> }
    }
    if (status === 'matched' || (score && score >= 0.70)) {
      return { label: 'Likely Match', color: 'text-emerald-400', icon: <Check className="w-3.5 h-3.5" /> }
    }
    if (status === 'ambiguous' || (score && score >= 0.55)) {
      return { label: 'Possible Match', color: 'text-amber-400', icon: <HelpCircle className="w-3.5 h-3.5" /> }
    }
    return { label: 'Likely No Match', color: 'text-red-400', icon: <X className="w-3.5 h-3.5" /> }
  }

  const parseCandidates = (json: string | null): MatchCandidateData[] => {
    if (!json) return []
    try { return JSON.parse(json) } catch { return [] }
  }

  const parseMatchData = (json: string | null): MatchCandidateData['voterRecord'] | null => {
    if (!json) return null
    try { return JSON.parse(json) } catch { return null }
  }

  // =============================================
  // RENDER
  // =============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.total_sheets}</p>
            <p className="text-[11px] text-white/40">Sheets Scanned</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.total_signatures}</p>
            <p className="text-[11px] text-white/40">Total Signatures</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.total_matched}</p>
            <p className="text-[11px] text-white/40">Matched to Voters</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.overall_validity_rate}%</p>
            <p className="text-[11px] text-white/40">Validity Rate</p>
          </div>
        </div>
      )}

      {/* View mode toggle */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1">
        <button
          onClick={() => setViewMode('sheets')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-colors ${
            viewMode === 'sheets' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
          }`}
        >
          <FileSignature className="w-3.5 h-3.5" />
          Sheets
        </button>
        <button
          onClick={() => setViewMode('petitioners')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-colors ${
            viewMode === 'petitioners' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Petitioners
        </button>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* SHEETS VIEW */}
      {/* ═══════════════════════════════════════════ */}
      {viewMode === 'sheets' && (
        <>
          {sheets.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <FileSignature className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No petition sheets scanned yet.</p>
              <p className="text-white/30 text-xs mt-1">Use the Scan Sheet panel and select &quot;Petition Sheet&quot; mode.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sheets.map(sheet => (
                <div
                  key={sheet.id}
                  className={`glass-card overflow-hidden ${sheet.is_duplicate ? 'border border-red-500/30' : ''}`}
                >
                  {/* Sheet header row */}
                  <button
                    onClick={() => toggleSheet(sheet.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    {expandedSheet === sheet.id
                      ? <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">
                          {sheet.petitioner_name || 'Unknown Petitioner'}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          sheet.status === 'matched'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : sheet.status === 'error'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-white/10 text-white/50'
                        }`}>
                          {sheet.status}
                        </span>
                        {sheet.is_duplicate && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-red-500/20 text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            DUPLICATE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/40">
                        {sheet.signature_count} signatures · Scanned by {sheet.scanned_by_name} · {new Date(sheet.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-bold ${
                        sheet.is_duplicate ? 'text-red-400/50' :
                        sheet.validity_rate >= 70 ? 'text-emerald-400' : sheet.validity_rate >= 50 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {sheet.status === 'matched' ? `${sheet.validity_rate}%` : '—'}
                      </p>
                      <p className="text-[10px] text-white/30">validity</p>
                    </div>
                  </button>

                  {/* Expanded: side-by-side signature comparison */}
                  {expandedSheet === sheet.id && (
                    <div className="border-t border-white/10 px-4 py-3">
                      {loadingSigs === sheet.id ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                        </div>
                      ) : (sheetSignatures[sheet.id] || []).length === 0 ? (
                        <p className="text-xs text-white/30 py-3 text-center">No signature details available.</p>
                      ) : (
                        <div className="space-y-3">
                          {(sheetSignatures[sheet.id] || []).map(sig => {
                            const matchInfo = matchStatusLabel(sig.match_status, sig.match_score, sig.user_confirmed)
                            const matchVoter = parseMatchData(sig.match_data)
                            const candidates = parseCandidates(sig.candidates_data)
                            const isPickerOpen = pickerSigId === sig.id

                            return (
                              <div key={sig.id} className="rounded-lg bg-white/[0.03] border border-white/5 overflow-hidden">
                                {/* Status header */}
                                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-white/20 font-mono w-5 text-right">
                                      {sig.line_number || '—'}
                                    </span>
                                    <span className={matchInfo.color}>{matchInfo.icon}</span>
                                    <span className={`text-xs font-bold ${matchInfo.color}`}>
                                      {matchInfo.label}
                                    </span>
                                    {sig.match_score !== null && (
                                      <span className={`text-[10px] font-mono ${
                                        sig.match_score >= 0.7 ? 'text-emerald-400/60' : sig.match_score >= 0.55 ? 'text-amber-400/60' : 'text-red-400/60'
                                      }`}>
                                        {Math.round(sig.match_score * 100)}%
                                      </span>
                                    )}
                                    {sig.user_confirmed && (
                                      <span className="text-[9px] px-1 py-0.5 rounded bg-white/10 text-white/40 font-bold">MANUAL</span>
                                    )}
                                  </div>
                                  {candidates.length > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setPickerSigId(isPickerOpen ? null : sig.id)
                                      }}
                                      className="text-[10px] text-white/40 hover:text-white/70 transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5"
                                    >
                                      <ArrowRightLeft className="w-3 h-3" />
                                      Change
                                    </button>
                                  )}
                                </div>

                                {/* Side-by-side comparison: OCR vs Voter File */}
                                <div className="grid grid-cols-1 md:grid-cols-2">
                                  {/* Left: OCR / Entered data */}
                                  <div className="p-3 md:border-r md:border-white/5">
                                    <p className="text-[9px] text-white/30 uppercase tracking-wider font-bold mb-1.5">OCR / Entered</p>
                                    <p className="text-sm font-bold text-white">
                                      {sig.first_name} {sig.last_name}
                                    </p>
                                    {sig.address && (
                                      <p className="text-[11px] text-white/50">{sig.address}</p>
                                    )}
                                    <p className="text-[11px] text-white/40">
                                      {[sig.city, sig.zip].filter(Boolean).join(', ') || '—'}
                                    </p>
                                    {sig.date_signed && (
                                      <p className="text-[10px] text-white/30 mt-1">Signed: {sig.date_signed}</p>
                                    )}
                                  </div>

                                  {/* Right: Voter File Match */}
                                  <div className="p-3 border-t border-white/5 md:border-t-0">
                                    <p className="text-[9px] text-white/30 uppercase tracking-wider font-bold mb-1.5">Voter File Match</p>
                                    {matchVoter ? (
                                      <>
                                        <p className="text-sm font-bold text-white">
                                          {matchVoter.first_name} {matchVoter.last_name}
                                        </p>
                                        {matchVoter.residential_address && (
                                          <p className="text-[11px] text-white/50">{matchVoter.residential_address}</p>
                                        )}
                                        <p className="text-[11px] text-white/40">
                                          {[matchVoter.city, matchVoter.state, matchVoter.zip].filter(Boolean).join(', ')}
                                        </p>
                                        <p className="text-[10px] text-white/30 mt-1">
                                          {matchVoter.party_affiliation} · {matchVoter.voter_status}
                                          {matchVoter.birth_year ? ` · Born ${matchVoter.birth_year}` : ''}
                                        </p>
                                      </>
                                    ) : (
                                      <p className="text-xs text-white/20 italic">No match found</p>
                                    )}
                                  </div>
                                </div>

                                {/* Candidate picker dropdown */}
                                {isPickerOpen && (
                                  <div className="border-t border-white/10 bg-white/[0.02] p-3">
                                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-2">
                                      Select a match ({candidates.length} candidate{candidates.length !== 1 ? 's' : ''})
                                    </p>
                                    <div className="space-y-1.5">
                                      {candidates.map((c, idx) => {
                                        const isCurrentMatch = matchVoter &&
                                          c.voterRecord.first_name === matchVoter.first_name &&
                                          c.voterRecord.last_name === matchVoter.last_name &&
                                          c.voterRecord.residential_address === matchVoter.residential_address
                                        return (
                                          <button
                                            key={idx}
                                            onClick={() => handleMatchOverride(sheet.id, sig.id, idx)}
                                            disabled={savingOverride}
                                            className={`w-full text-left rounded-md px-3 py-2 transition-colors ${
                                              isCurrentMatch
                                                ? 'bg-emerald-500/10 border border-emerald-500/30'
                                                : 'bg-white/[0.03] border border-white/5 hover:bg-white/[0.06]'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between">
                                              <div>
                                                <p className="text-xs font-bold text-white">
                                                  {c.voterRecord.first_name} {c.voterRecord.last_name}
                                                  {isCurrentMatch && <span className="text-[9px] text-emerald-400 ml-2">(current)</span>}
                                                </p>
                                                <p className="text-[10px] text-white/40">
                                                  {c.voterRecord.residential_address ? `${c.voterRecord.residential_address}, ` : ''}
                                                  {c.voterRecord.city}, {c.voterRecord.zip}
                                                  {' · '}{c.voterRecord.party_affiliation}
                                                </p>
                                              </div>
                                              <span className={`text-xs font-mono font-bold ${
                                                c.score >= 0.7 ? 'text-emerald-400' : c.score >= 0.55 ? 'text-amber-400' : 'text-red-400'
                                              }`}>
                                                {Math.round(c.score * 100)}%
                                              </span>
                                            </div>
                                          </button>
                                        )
                                      })}

                                      {/* Mark as No Match option */}
                                      <button
                                        onClick={() => handleMatchOverride(sheet.id, sig.id, null)}
                                        disabled={savingOverride}
                                        className="w-full text-left rounded-md px-3 py-2 bg-white/[0.03] border border-white/5 hover:bg-red-500/10 hover:border-red-500/20 transition-colors"
                                      >
                                        <p className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                                          <X className="w-3 h-3" />
                                          Mark as No Match
                                        </p>
                                      </button>
                                    </div>

                                    {savingOverride && (
                                      <div className="flex items-center justify-center gap-2 mt-2 text-xs text-white/40">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Updating...
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* PETITIONERS VIEW */}
      {/* ═══════════════════════════════════════════ */}
      {viewMode === 'petitioners' && (
        <>
          {loadingPetitioners ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            </div>
          ) : petitioners.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No petitioners identified yet.</p>
              <p className="text-white/30 text-xs mt-1">Petitioners are automatically recognized when scanning petition sheets.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {petitioners.map(p => {
                const isExpanded = expandedPetitioner === p.id
                const computedValidity = Number(p.total_sigs) > 0
                  ? Math.round(Number(p.total_matched) / Number(p.total_sigs) * 1000) / 10
                  : 0
                const variants: string[] = (() => {
                  try { return JSON.parse(p.name_variants) } catch { return [] }
                })()

                return (
                  <div key={p.id} className="glass-card overflow-hidden">
                    <button
                      onClick={() => setExpandedPetitioner(isExpanded ? null : p.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                    >
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{p.canonical_name}</p>
                        <p className="text-[11px] text-white/40">
                          {p.sheets_count} sheet{Number(p.sheets_count) !== 1 ? 's' : ''} · {p.total_sigs} signatures
                          {variants.length > 1 && (
                            <span className="ml-1 text-white/25">
                              · also: {variants.filter(v => v !== p.canonical_name).join(', ')}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-lg font-bold ${
                          computedValidity >= 70 ? 'text-emerald-400' : computedValidity >= 50 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {Number(p.total_sigs) > 0 ? `${computedValidity}%` : '—'}
                        </p>
                        <p className="text-[10px] text-white/30">validity</p>
                      </div>
                    </button>

                    {/* Expanded: list of sheets for this petitioner */}
                    {isExpanded && (
                      <div className="border-t border-white/10 px-4 py-2 space-y-1">
                        {p.sheets.length === 0 ? (
                          <p className="text-xs text-white/30 py-2 text-center">No sheets linked.</p>
                        ) : (
                          p.sheets.map(sheet => (
                            <div
                              key={sheet.id}
                              className={`flex items-center justify-between py-2 px-2 rounded ${
                                sheet.is_duplicate ? 'bg-red-500/5' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  sheet.status === 'matched'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : sheet.status === 'error'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-white/10 text-white/50'
                                }`}>
                                  {sheet.status}
                                </span>
                                {sheet.is_duplicate && (
                                  <span className="text-[10px] px-1 py-0.5 rounded font-bold uppercase bg-red-500/20 text-red-400">DUP</span>
                                )}
                                <span className="text-xs text-white/60">
                                  {sheet.total_signatures} sigs · {new Date(sheet.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <span className={`text-sm font-bold ${
                                sheet.validity_rate >= 70 ? 'text-emerald-400' : sheet.validity_rate >= 50 ? 'text-amber-400' : 'text-red-400'
                              }`}>
                                {sheet.status === 'matched' ? `${sheet.validity_rate}%` : '—'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
