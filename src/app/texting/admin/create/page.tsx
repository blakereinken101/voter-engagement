'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Upload, Plus, X, Loader2, Check } from 'lucide-react'
import Link from 'next/link'

type Step = 'basics' | 'contacts' | 'script' | 'review'

interface ContactRow {
  firstName: string
  lastName: string
  cell: string
  customFields?: Record<string, string>
}

export default function CreateTextCampaignPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('basics')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Basics
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sendingMode, setSendingMode] = useState<'p2p' | 'blast'>('p2p')

  // Contacts
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)

  // Script
  const [scriptBody, setScriptBody] = useState('Hi {firstName}, ')

  const steps: Step[] = ['basics', 'contacts', 'script', 'review']
  const stepIndex = steps.indexOf(step)

  const canProceed = () => {
    if (step === 'basics') return title.trim().length > 0
    if (step === 'contacts') return contacts.length > 0
    if (step === 'script') return scriptBody.trim().length > 0
    return true
  }

  const handleCSVUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvError(null)

    try {
      const text = await file.text()
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) { setCsvError('CSV must have at least a header and one data row'); return }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))

      // Auto-detect columns
      const firstNameCol = headers.findIndex(h => /first.?name|firstname|first/i.test(h))
      const lastNameCol = headers.findIndex(h => /last.?name|lastname|last/i.test(h))
      const cellCol = headers.findIndex(h => /cell|phone|mobile|tel/i.test(h))

      if (firstNameCol === -1 || lastNameCol === -1 || cellCol === -1) {
        setCsvError('CSV must have columns for firstName, lastName, and cell/phone')
        return
      }

      const parsed: ContactRow[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''))
        const firstName = cols[firstNameCol]?.trim()
        const lastName = cols[lastNameCol]?.trim()
        const cell = cols[cellCol]?.trim()
        if (firstName && lastName && cell) {
          parsed.push({ firstName, lastName, cell })
        }
      }
      setContacts(parsed)
    } catch {
      setCsvError('Failed to parse CSV file')
    }
  }, [])

  const insertVariable = (variable: string) => {
    setScriptBody(prev => prev + `{${variable}}`)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      // 1. Create campaign
      const campaignRes = await fetch('/api/texting/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined, sendingMode }),
      })
      if (!campaignRes.ok) {
        const data = await campaignRes.json()
        throw new Error(data.error || 'Failed to create campaign')
      }
      const { campaign } = await campaignRes.json()

      // 2. Import contacts
      if (contacts.length > 0) {
        const contactsRes = await fetch(`/api/texting/campaigns/${campaign.id}/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts }),
        })
        if (!contactsRes.ok) {
          const data = await contactsRes.json()
          throw new Error(data.error || 'Failed to import contacts')
        }
      }

      // 3. Create initial script
      if (scriptBody.trim()) {
        const scriptRes = await fetch(`/api/texting/campaigns/${campaign.id}/scripts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scriptType: 'initial', title: 'Initial Message', body: scriptBody.trim() }),
        })
        if (!scriptRes.ok) {
          const data = await scriptRes.json()
          throw new Error(data.error || 'Failed to create script')
        }
      }

      router.push(`/texting/admin/${campaign.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-vc-bg">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/texting/admin" className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Campaigns
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">Create Text Campaign</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < stepIndex ? 'bg-amber-500 text-black' :
                i === stepIndex ? 'bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/50' :
                'bg-white/10 text-white/40'
              }`}>
                {i < stepIndex ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-sm font-medium ${i === stepIndex ? 'text-white' : 'text-white/40'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
              {i < steps.length - 1 && <div className="w-8 h-px bg-white/10" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Step: Basics */}
        {step === 'basics' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Campaign Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Fundraising Ask - March 2026"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Internal notes about this campaign..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Sending Mode</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setSendingMode('p2p')}
                  className={`flex-1 p-4 rounded-lg border text-left transition-colors ${
                    sendingMode === 'p2p'
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="font-semibold text-white mb-1">P2P (Peer-to-Peer)</div>
                  <div className="text-sm text-white/50">Texters click send on each message individually.</div>
                </button>
                <button
                  onClick={() => setSendingMode('blast')}
                  className={`flex-1 p-4 rounded-lg border text-left transition-colors ${
                    sendingMode === 'blast'
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="font-semibold text-white mb-1">Blast Mode</div>
                  <div className="text-sm text-white/50">Initial messages sent automatically. Replies handled by texters.</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Contacts */}
        {step === 'contacts' && (
          <div className="space-y-6">
            <div className="bg-vc-surface border border-white/10 rounded-xl p-6">
              <h3 className="font-semibold text-white mb-3">Upload Contacts (CSV)</h3>
              <p className="text-sm text-white/50 mb-4">
                Your CSV must include columns for first name, last name, and cell/phone number.
              </p>
              <label className="flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-white/20 rounded-lg hover:border-amber-500/40 cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-white/40" />
                <span className="text-white/60">Choose CSV file</span>
                <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
              </label>
              {csvError && <p className="text-red-400 text-sm mt-2">{csvError}</p>}
            </div>

            {contacts.length > 0 && (
              <div className="bg-vc-surface border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">{contacts.length} contacts loaded</h3>
                  <button onClick={() => setContacts([])} className="text-sm text-red-400 hover:text-red-300">
                    Clear
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {contacts.slice(0, 10).map((c, i) => (
                    <div key={i} className="text-sm text-white/60 flex gap-4">
                      <span className="w-48 truncate">{c.firstName} {c.lastName}</span>
                      <span className="text-white/30">{c.cell}</span>
                    </div>
                  ))}
                  {contacts.length > 10 && (
                    <div className="text-sm text-white/30">...and {contacts.length - 10} more</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Script */}
        {step === 'script' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Initial Message Script *</label>
              <div className="flex gap-2 mb-3">
                {['firstName', 'lastName', 'fullName'].map(v => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v)}
                    className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors"
                  >
                    {`{${v}}`}
                  </button>
                ))}
              </div>
              <textarea
                value={scriptBody}
                onChange={e => setScriptBody(e.target.value)}
                rows={6}
                placeholder="Type your message here. Use {firstName} to personalize."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 outline-none resize-none font-mono text-sm"
              />
              <p className="text-xs text-white/30 mt-2">
                {scriptBody.length} characters - {Math.ceil(scriptBody.length / 160)} SMS segment(s)
              </p>
            </div>

            {scriptBody && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h4 className="text-xs font-medium text-white/40 uppercase mb-2">Preview</h4>
                <p className="text-sm text-white">
                  {scriptBody
                    .replace(/\{firstName\}/g, 'Jane')
                    .replace(/\{lastName\}/g, 'Smith')
                    .replace(/\{fullName\}/g, 'Jane Smith')
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="bg-vc-surface border border-white/10 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-3">Campaign Summary</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-white/50">Title</dt>
                  <dd className="text-white font-medium">{title}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-white/50">Sending Mode</dt>
                  <dd className="text-white font-medium uppercase">{sendingMode}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-white/50">Contacts</dt>
                  <dd className="text-white font-medium">{contacts.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-white/50">Script Length</dt>
                  <dd className="text-white font-medium">{scriptBody.length} chars ({Math.ceil(scriptBody.length / 160)} segment{Math.ceil(scriptBody.length / 160) !== 1 ? 's' : ''})</dd>
                </div>
              </dl>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <h4 className="text-xs font-medium text-white/40 uppercase mb-2">Message Preview</h4>
              <p className="text-sm text-white whitespace-pre-wrap">
                {scriptBody
                  .replace(/\{firstName\}/g, 'Jane')
                  .replace(/\{lastName\}/g, 'Smith')
                  .replace(/\{fullName\}/g, 'Jane Smith')
                }
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
          <button
            onClick={() => setStep(steps[stepIndex - 1])}
            disabled={stepIndex === 0}
            className="flex items-center gap-2 px-4 py-2 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {step === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-black font-semibold rounded-btn hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {isSubmitting ? 'Creating...' : 'Create Campaign'}
            </button>
          ) : (
            <button
              onClick={() => setStep(steps[stepIndex + 1])}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 font-medium rounded-btn hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
