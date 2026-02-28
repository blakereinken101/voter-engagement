'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAppContext } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { ArrowLeft, Trash2, Check, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import Link from 'next/link'
import Image from 'next/image'
import type { RelationshipCategory, ContactOutcome } from '@/types'

const CATEGORY_OPTIONS: { value: RelationshipCategory; label: string }[] = [
  { value: 'household', label: 'Household' },
  { value: 'close-family', label: 'Close Family' },
  { value: 'extended-family', label: 'Extended Family' },
  { value: 'best-friends', label: 'Best Friends' },
  { value: 'close-friends', label: 'Close Friends' },
  { value: 'neighbors', label: 'Neighbors' },
  { value: 'coworkers', label: 'Coworkers' },
  { value: 'faith-community', label: 'Faith Community' },
  { value: 'school-pta', label: 'School / PTA' },
  { value: 'sports-recreation', label: 'Sports / Recreation' },
  { value: 'hobby-groups', label: 'Hobby Groups' },
  { value: 'community-regulars', label: 'Community Regulars' },
  { value: 'recent-meals', label: 'Recent Meals' },
  { value: 'who-did-we-miss', label: 'Other' },
]

const SUPPORT_STATUS_OPTIONS: { value: ContactOutcome | ''; label: string }[] = [
  { value: '', label: 'No status' },
  { value: 'supporter', label: 'Supporter' },
  { value: 'undecided', label: 'Undecided' },
  { value: 'opposed', label: 'Opposed' },
  { value: 'left-message', label: 'Left Msg' },
  { value: 'no-answer', label: 'No Answer' },
]

const VOLUNTEER_OPTIONS: { value: '' | 'yes' | 'no' | 'maybe'; label: string }[] = [
  { value: '', label: 'Vol?' },
  { value: 'yes', label: 'Vol: Yes' },
  { value: 'maybe', label: 'Vol: Maybe' },
  { value: 'no', label: 'Vol: No' },
]

interface ExtractedContact {
  firstName: string
  lastName: string
  phone?: string
  city?: string
  address?: string
  notes?: string
  included: boolean
  category: RelationshipCategory
  contactOutcome?: ContactOutcome
  volunteerInterest?: 'yes' | 'no' | 'maybe'
}

export default function ScanReviewPage() {
  const router = useRouter()
  const { addPerson } = useAppContext()
  const { campaignConfig: authConfig } = useAuth()

  const [contacts, setContacts] = useState<ExtractedContact[]>([])
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState(0)
  const [done, setDone] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load scanned contacts from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('scan-sheet-contacts')
      const thumb = sessionStorage.getItem('scan-sheet-thumbnail')
      if (!raw) {
        router.replace('/dashboard')
        return
      }
      const parsed = JSON.parse(raw) as ExtractedContact[]
      if (!parsed.length) {
        router.replace('/dashboard')
        return
      }
      setContacts(parsed)
      if (thumb) setThumbnailUrl(thumb)
      setLoaded(true)
    } catch {
      router.replace('/dashboard')
    }
  }, [router])

  const updateContact = useCallback((index: number, field: string, value: string | boolean) => {
    setContacts(prev =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    )
  }, [])

  const removeContact = useCallback((index: number) => {
    setContacts(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleImport = useCallback(() => {
    const toImport = contacts.filter(c => c.included && c.firstName.trim() && c.lastName.trim())
    let count = 0

    for (const c of toImport) {
      const initialActionData: { contactOutcome?: ContactOutcome; volunteerInterest?: 'yes' | 'no' | 'maybe' } = {}
      if (c.contactOutcome) initialActionData.contactOutcome = c.contactOutcome
      if (c.volunteerInterest) initialActionData.volunteerInterest = c.volunteerInterest

      addPerson(
        {
          firstName: c.firstName.trim(),
          lastName: c.lastName.trim(),
          phone: c.phone?.trim() || undefined,
          city: c.city?.trim() || undefined,
          address: c.address?.trim() || undefined,
          category: c.category,
        },
        undefined,
        Object.keys(initialActionData).length > 0 ? initialActionData : undefined,
      )
      count++
    }

    // Clean up sessionStorage
    sessionStorage.removeItem('scan-sheet-contacts')
    sessionStorage.removeItem('scan-sheet-thumbnail')

    setImportedCount(count)
    setDone(true)
  }, [contacts, addPerson])

  const handleBack = useCallback(() => {
    sessionStorage.removeItem('scan-sheet-contacts')
    sessionStorage.removeItem('scan-sheet-thumbnail')
    router.push('/dashboard')
  }, [router])

  const includedCount = contacts.filter(c => c.included).length

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
          <div className="w-14 h-14 rounded-full bg-vc-teal/20 flex items-center justify-center">
            <Check className="w-7 h-7 text-vc-teal" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">
              {importedCount} {importedCount === 1 ? 'contact' : 'contacts'} imported!
            </p>
            <p className="text-sm text-white/40 mt-1">
              They&apos;ve been added to your rolodex.
            </p>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                setDone(false)
                setContacts([])
                setImportedCount(0)
                router.push('/dashboard')
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-btn text-sm font-bold glass hover:border-white/20 text-white/60 hover:text-white transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Back to Chat
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-5 py-2.5 rounded-btn text-sm font-bold bg-vc-purple text-white hover:bg-vc-purple-light shadow-glow transition-all"
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
      <header className="glass-dark border-b border-white/10 shrink-0 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="text-white/50 hover:text-white transition-colors p-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white">Review Scanned Contacts</h1>
            <p className="text-[11px] text-white/40">
              {contacts.length} contacts found — edit any errors below
            </p>
          </div>
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt="Scanned sheet"
              className="w-10 h-10 object-cover rounded-lg border border-white/10 shrink-0"
            />
          )}
        </div>
      </header>

      {/* Contact list — full native scroll */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {contacts.map((contact, idx) => (
            <div
              key={idx}
              className={clsx(
                'glass-card p-4 space-y-3',
                !contact.included && 'opacity-40',
              )}
            >
              {/* Row header: checkbox + name + delete */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={contact.included}
                  onChange={e => updateContact(idx, 'included', e.target.checked)}
                  className="w-5 h-5 rounded accent-vc-purple shrink-0"
                />
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={contact.firstName}
                    onChange={e => updateContact(idx, 'firstName', e.target.value)}
                    placeholder="First name"
                    className="glass-input px-3 py-2 text-sm rounded"
                  />
                  <input
                    type="text"
                    value={contact.lastName}
                    onChange={e => updateContact(idx, 'lastName', e.target.value)}
                    placeholder="Last name"
                    className="glass-input px-3 py-2 text-sm rounded"
                  />
                </div>
                <button
                  onClick={() => removeContact(idx)}
                  className="text-white/20 hover:text-red-400 transition-colors p-1.5 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Extra fields */}
              {contact.included && (
                <div className="grid grid-cols-2 gap-2 pl-8">
                  <input
                    type="text"
                    value={contact.phone || ''}
                    onChange={e => updateContact(idx, 'phone', e.target.value)}
                    placeholder="Phone"
                    className="glass-input px-3 py-2 text-sm rounded"
                  />
                  <input
                    type="text"
                    value={contact.city || ''}
                    onChange={e => updateContact(idx, 'city', e.target.value)}
                    placeholder="City"
                    className="glass-input px-3 py-2 text-sm rounded"
                  />
                  <select
                    value={contact.category}
                    onChange={e => updateContact(idx, 'category', e.target.value)}
                    className="glass-input px-3 py-2 text-sm rounded col-span-2"
                  >
                    {CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={contact.contactOutcome || ''}
                    onChange={e => updateContact(idx, 'contactOutcome', e.target.value || undefined as unknown as string)}
                    className="glass-input px-3 py-2 text-sm rounded"
                  >
                    {SUPPORT_STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={contact.volunteerInterest || ''}
                    onChange={e => updateContact(idx, 'volunteerInterest', e.target.value || undefined as unknown as string)}
                    className="glass-input px-3 py-2 text-sm rounded"
                  >
                    {VOLUNTEER_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {contact.notes && (
                    <p className="text-[11px] text-white/40 col-span-2 italic">
                      AI notes: {contact.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Sticky import bar */}
      <div className="glass-dark border-t border-white/10 sticky bottom-0 z-20 safe-bottom">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-white/50 font-display tabular-nums">
            {includedCount} of {contacts.length} selected
          </p>
          <button
            onClick={handleImport}
            disabled={includedCount === 0}
            className={clsx(
              'px-6 py-2.5 rounded-btn text-sm font-bold transition-all',
              includedCount > 0
                ? 'bg-vc-purple text-white hover:bg-vc-purple-light shadow-glow'
                : 'bg-white/10 text-white/30 cursor-not-allowed',
            )}
          >
            Import {includedCount} {includedCount === 1 ? 'Contact' : 'Contacts'}
          </button>
        </div>
      </div>
    </div>
  )
}
