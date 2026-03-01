'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Check, Trash2, RotateCcw, FileSignature, Loader2 } from 'lucide-react'

interface PetitionSignature {
  lineNumber?: number
  firstName: string
  lastName: string
  address?: string
  city?: string
  zip?: string
  dateSigned?: string
  included: boolean
}

export default function PetitionReviewPage() {
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [signatures, setSignatures] = useState<PetitionSignature[]>([])
  const [petitionerName, setPetitionerName] = useState('')
  const [sheetDate, setSheetDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [matchResult, setMatchResult] = useState<{ matchedCount: number; validityRate: number } | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('petition-sheet-signatures')
    if (!raw) {
      router.replace('/dashboard')
      return
    }
    try {
      const parsed = JSON.parse(raw) as Array<Omit<PetitionSignature, 'included'>>
      setSignatures(parsed.map(s => ({ ...s, included: true })))
    } catch {
      router.replace('/dashboard')
      return
    }

    const petitioner = sessionStorage.getItem('petition-sheet-petitioner')
    if (petitioner) setPetitionerName(petitioner)
    const date = sessionStorage.getItem('petition-sheet-date')
    if (date) setSheetDate(date)

    setLoaded(true)
  }, [router])

  const updateSignature = useCallback((idx: number, field: keyof PetitionSignature, value: string | boolean) => {
    setSignatures(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }, [])

  const removeSignature = useCallback((idx: number) => {
    setSignatures(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const handleBack = useCallback(() => {
    sessionStorage.removeItem('petition-sheet-signatures')
    sessionStorage.removeItem('petition-sheet-thumbnail')
    sessionStorage.removeItem('petition-sheet-petitioner')
    sessionStorage.removeItem('petition-sheet-date')
    router.push('/dashboard')
  }, [router])

  const handleSaveAndMatch = useCallback(async () => {
    const toSave = signatures.filter(s => s.included)
    if (toSave.length === 0) return

    setSaving(true)
    try {
      // Save petition sheet + signatures
      const saveRes = await fetch('/api/admin/petitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          petitionerName: petitionerName.trim() || undefined,
          signatures: toSave.map((s, idx) => ({
            lineNumber: s.lineNumber || idx + 1,
            firstName: s.firstName.trim(),
            lastName: s.lastName.trim(),
            address: s.address?.trim() || undefined,
            city: s.city?.trim() || undefined,
            zip: s.zip?.trim() || undefined,
            dateSigned: s.dateSigned?.trim() || sheetDate.trim() || undefined,
          })),
        }),
      })

      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save petition')
      }

      const saveData = await saveRes.json()
      setSavedCount(saveData.signatureCount || toSave.length)

      // Trigger voter file matching
      try {
        const matchRes = await fetch(`/api/admin/petitions/${saveData.sheetId}/match`, {
          method: 'POST',
        })
        if (matchRes.ok) {
          const matchData = await matchRes.json()
          setMatchResult({
            matchedCount: matchData.matchedCount,
            validityRate: matchData.validityRate,
          })
        }
      } catch {
        // Matching failure is non-fatal — sheet is still saved
        console.error('[petition] Matching failed, but sheet was saved')
      }
    } catch (err) {
      console.error('[petition-save]', err)
      return
    } finally {
      setSaving(false)
    }

    // Clean up sessionStorage
    sessionStorage.removeItem('petition-sheet-signatures')
    sessionStorage.removeItem('petition-sheet-thumbnail')
    sessionStorage.removeItem('petition-sheet-petitioner')
    sessionStorage.removeItem('petition-sheet-date')

    setDone(true)
  }, [signatures, petitionerName, sheetDate])

  const includedCount = signatures.filter(s => s.included).length

  if (!loaded) return null

  // ─── DONE STATE ───
  if (done) {
    return (
      <div className="cosmic-bg constellation min-h-[100dvh] flex flex-col safe-top">
        <header className="glass-dark border-b border-white/10 shrink-0">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/dashboard" className="hover:opacity-80 transition-opacity">
              <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-10 w-auto" priority />
            </Link>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-7 h-7 text-emerald-400" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">
              {savedCount} {savedCount === 1 ? 'signature' : 'signatures'} saved!
            </p>
            {matchResult && (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-white/60">
                  Matched against voter file: <span className="font-bold text-emerald-400">{matchResult.matchedCount}</span> of {savedCount}
                </p>
                <p className="text-2xl font-bold text-emerald-400">
                  {matchResult.validityRate}% validity rate
                </p>
              </div>
            )}
            {!matchResult && (
              <p className="text-sm text-white/40 mt-1">
                Signatures saved. Voter matching will be available once a voter file is assigned.
              </p>
            )}
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-5 py-2.5 rounded-btn text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 shadow-glow transition-all"
            >
              Done
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ─── REVIEW STATE ───
  return (
    <div className="cosmic-bg constellation min-h-[100dvh] flex flex-col safe-top">
      {/* Header */}
      <header className="glass-dark border-b border-white/10 shrink-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={handleBack}>
            <ArrowLeft className="w-5 h-5 text-white/60 hover:text-white transition-colors" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-emerald-400" />
              Review Petition Signatures
            </h1>
            <p className="text-[11px] text-white/40">
              <span className="font-bold text-white/70">{signatures.length}</span>
              {' '}signatures found — edit any errors below
            </p>
          </div>
        </div>
      </header>

      {/* Petition info banner */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-3">
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Petition Sheet</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Petitioner / Circulator</label>
              <input
                type="text"
                value={petitionerName}
                onChange={e => setPetitionerName(e.target.value)}
                placeholder="Petitioner name"
                className="glass-input px-3 py-1.5 text-sm rounded w-full mt-0.5"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Date</label>
              <input
                type="text"
                value={sheetDate}
                onChange={e => setSheetDate(e.target.value)}
                placeholder="Sheet date"
                className="glass-input px-3 py-1.5 text-sm rounded w-full mt-0.5"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Signature list */}
      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-3 max-w-2xl mx-auto w-full space-y-2">
        {signatures.map((sig, idx) => (
          <div key={idx} className={`glass-card p-3 space-y-2 transition-opacity ${!sig.included ? 'opacity-40' : ''}`}>
            {/* Top row: checkbox, line number, name, delete */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sig.included}
                onChange={e => updateSignature(idx, 'included', e.target.checked)}
                className="accent-emerald-500 w-4 h-4 shrink-0"
              />
              <span className="text-[10px] text-white/30 font-mono w-5 shrink-0">
                {sig.lineNumber || idx + 1}
              </span>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={sig.firstName}
                  onChange={e => updateSignature(idx, 'firstName', e.target.value)}
                  placeholder="First name"
                  className="glass-input px-2 py-1.5 text-sm rounded font-bold text-white"
                />
                <input
                  type="text"
                  value={sig.lastName}
                  onChange={e => updateSignature(idx, 'lastName', e.target.value)}
                  placeholder="Last name"
                  className="glass-input px-2 py-1.5 text-sm rounded font-bold text-white"
                />
              </div>
              <button
                onClick={() => removeSignature(idx)}
                className="text-white/20 hover:text-red-400 transition-colors p-1 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Detail fields */}
            {sig.included && (
              <div className="grid grid-cols-6 gap-2 pl-8">
                <input
                  type="text"
                  value={sig.address || ''}
                  onChange={e => updateSignature(idx, 'address', e.target.value)}
                  placeholder="Street address"
                  className="glass-input px-2 py-1.5 text-xs rounded col-span-6"
                />
                <input
                  type="text"
                  value={sig.city || ''}
                  onChange={e => updateSignature(idx, 'city', e.target.value)}
                  placeholder="City"
                  className="glass-input px-2 py-1.5 text-xs rounded col-span-2"
                />
                <input
                  type="text"
                  value={sig.zip || ''}
                  onChange={e => updateSignature(idx, 'zip', e.target.value)}
                  placeholder="Zip"
                  className="glass-input px-2 py-1.5 text-xs rounded col-span-2"
                />
                <input
                  type="text"
                  value={sig.dateSigned || ''}
                  onChange={e => updateSignature(idx, 'dateSigned', e.target.value)}
                  placeholder="Date signed"
                  className="glass-input px-2 py-1.5 text-xs rounded col-span-2"
                />
              </div>
            )}
          </div>
        ))}
      </main>

      {/* Sticky save bar */}
      <div className="glass-dark border-t border-white/10 sticky bottom-0 z-20 safe-bottom">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-white/50 font-display tabular-nums">
            {includedCount} of {signatures.length} selected
          </p>
          <button
            onClick={handleSaveAndMatch}
            disabled={includedCount === 0 || saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-btn text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 shadow-glow transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Matching...
              </>
            ) : (
              <>
                <FileSignature className="w-4 h-4" />
                Save & Match ({includedCount})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
