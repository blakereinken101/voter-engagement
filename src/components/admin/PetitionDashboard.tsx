'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileSignature, ChevronDown, ChevronRight, Check, X, HelpCircle, Loader2 } from 'lucide-react'

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
}

interface PetitionSheet {
  id: string
  petitioner_name: string | null
  scanned_by_name: string
  total_signatures: number
  matched_count: number
  validity_rate: number
  status: string
  created_at: string
  signature_count: string
}

interface PetitionStats {
  total_sheets: string
  total_signatures: string
  total_matched: string
  overall_validity_rate: string
}

export default function PetitionDashboard() {
  const [sheets, setSheets] = useState<PetitionSheet[]>([])
  const [stats, setStats] = useState<PetitionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedSheet, setExpandedSheet] = useState<string | null>(null)
  const [sheetSignatures, setSheetSignatures] = useState<Record<string, PetitionSignatureRow[]>>({})
  const [loadingSigs, setLoadingSigs] = useState<string | null>(null)

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

  const toggleSheet = useCallback(async (sheetId: string) => {
    if (expandedSheet === sheetId) {
      setExpandedSheet(null)
      return
    }
    setExpandedSheet(sheetId)

    // Load signatures if not already loaded
    if (!sheetSignatures[sheetId]) {
      setLoadingSigs(sheetId)
      try {
        // We need to fetch individual sheet signatures — use a simple query via the list endpoint
        // For now we'll add a query param to the GET endpoint
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

  const matchStatusIcon = (status: string) => {
    switch (status) {
      case 'matched': return <Check className="w-3.5 h-3.5 text-emerald-400" />
      case 'unmatched': return <X className="w-3.5 h-3.5 text-red-400" />
      case 'ambiguous': return <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
      default: return <span className="w-3.5 h-3.5 rounded-full bg-white/20 inline-block" />
    }
  }

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

      {/* Sheet list */}
      {sheets.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <FileSignature className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No petition sheets scanned yet.</p>
          <p className="text-white/30 text-xs mt-1">Use the Scan Sheet panel and select &quot;Petition Sheet&quot; mode.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sheets.map(sheet => (
            <div key={sheet.id} className="glass-card overflow-hidden">
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
                  <div className="flex items-center gap-2">
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
                  </div>
                  <p className="text-[11px] text-white/40">
                    {sheet.signature_count} signatures · Scanned by {sheet.scanned_by_name} · {new Date(sheet.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-lg font-bold ${sheet.validity_rate >= 70 ? 'text-emerald-400' : sheet.validity_rate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                    {sheet.status === 'matched' ? `${sheet.validity_rate}%` : '—'}
                  </p>
                  <p className="text-[10px] text-white/30">validity</p>
                </div>
              </button>

              {/* Expanded: signature details */}
              {expandedSheet === sheet.id && (
                <div className="border-t border-white/10 px-4 py-2">
                  {loadingSigs === sheet.id ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                    </div>
                  ) : (sheetSignatures[sheet.id] || []).length === 0 ? (
                    <p className="text-xs text-white/30 py-3 text-center">No signature details available.</p>
                  ) : (
                    <div className="space-y-1 py-1">
                      {(sheetSignatures[sheet.id] || []).map(sig => (
                        <div key={sig.id} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
                          <span className="text-[10px] text-white/20 font-mono w-5 shrink-0 text-right">
                            {sig.line_number || '—'}
                          </span>
                          {matchStatusIcon(sig.match_status)}
                          <span className="text-xs text-white font-medium flex-shrink-0">
                            {sig.first_name} {sig.last_name}
                          </span>
                          <span className="text-[11px] text-white/30 truncate flex-1">
                            {[sig.address, sig.city, sig.zip].filter(Boolean).join(', ') || '—'}
                          </span>
                          {sig.date_signed && (
                            <span className="text-[10px] text-white/30 shrink-0">{sig.date_signed}</span>
                          )}
                          {sig.match_score !== null && (
                            <span className={`text-[10px] font-mono shrink-0 ${
                              sig.match_score >= 0.7 ? 'text-emerald-400' : sig.match_score >= 0.55 ? 'text-amber-400' : 'text-red-400'
                            }`}>
                              {Math.round(sig.match_score * 100)}%
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
