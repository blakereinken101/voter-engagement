'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useAppContext } from '@/context/AppContext'
import { compressImage } from '@/lib/image-compress'
import { Camera, Upload, X, Loader2, Check, RotateCcw, Trash2 } from 'lucide-react'
import clsx from 'clsx'
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
  { value: 'left-message', label: 'Left Message' },
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

type PanelState = 'idle' | 'processing' | 'review' | 'done'

interface ScanSheetPanelProps {
  onClose: () => void
}

export default function ScanSheetPanel({ onClose }: ScanSheetPanelProps) {
  const { addPerson } = useAppContext()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const [panelState, setPanelState] = useState<PanelState>('idle')
  const [contacts, setContacts] = useState<ExtractedContact[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState(0)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)

  // Lock body scroll when panel is open to prevent shaking on mobile
  useEffect(() => {
    const orig = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = orig }
  }, [])

  const handleImageSelected = useCallback(async (file: File) => {
    setError(null)
    setPanelState('processing')

    try {
      // Compress the image
      const { base64, mimeType } = await compressImage(file)

      // Create thumbnail for display
      setThumbnailUrl(`data:${mimeType};base64,${base64}`)

      // Send to API
      const response = await fetch('/api/ai/scan-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to scan image')
      }

      const data = await response.json()
      const extracted: ExtractedContact[] = (data.contacts || []).map(
        (c: { firstName: string; lastName: string; phone?: string; city?: string; address?: string; notes?: string; category?: string; supportStatus?: string; volunteerInterest?: string }) => ({
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          city: c.city,
          address: c.address,
          notes: c.notes,
          included: true,
          category: (CATEGORY_OPTIONS.some(opt => opt.value === c.category) ? c.category : 'who-did-we-miss') as RelationshipCategory,
          contactOutcome: SUPPORT_STATUS_OPTIONS.some(opt => opt.value === c.supportStatus) ? c.supportStatus as ContactOutcome : undefined,
          volunteerInterest: (['yes', 'no', 'maybe'].includes(c.volunteerInterest || '') ? c.volunteerInterest as 'yes' | 'no' | 'maybe' : undefined),
        }),
      )

      if (extracted.length === 0) {
        setError('No contacts found in the image. Try a clearer photo or different angle.')
        setPanelState('idle')
        return
      }

      setContacts(extracted)
      setPanelState('review')
    } catch (err) {
      console.error('[ScanSheet] Error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPanelState('idle')
    }
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleImageSelected(file)
      // Reset input so the same file can be re-selected
      e.target.value = ''
    },
    [handleImageSelected],
  )

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

    setImportedCount(count)
    setPanelState('done')
  }, [contacts, addPerson])

  const handleReset = useCallback(() => {
    setContacts([])
    setError(null)
    setImportedCount(0)
    setThumbnailUrl(null)
    setPanelState('idle')
  }, [])

  const includedCount = contacts.filter(c => c.included).length

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg max-h-[85dvh] overflow-y-auto overscroll-contain glass-card mx-4 animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-dark flex items-center justify-between px-4 py-3 border-b border-white/10 rounded-t-2xl">
          <div>
            <h2 className="text-sm font-bold text-white">Scan Contact Sheet</h2>
            <p className="text-[10px] text-white/40">
              {panelState === 'idle' && 'Take a photo or upload an image'}
              {panelState === 'processing' && 'Reading handwriting...'}
              {panelState === 'review' && `${contacts.length} contacts found — review & import`}
              {panelState === 'done' && `${importedCount} contacts imported!`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Error */}
          {error && (
            <div className="bg-red-500/20 text-red-300 text-xs px-3 py-2 rounded-lg border border-red-500/30">
              {error}
            </div>
          )}

          {/* ─── IDLE STATE ─── */}
          {panelState === 'idle' && (
            <div className="space-y-3">
              <p className="text-xs text-white/60 leading-relaxed">
                Photograph a handwritten contact sheet and AI will extract the names and details for you.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Camera button */}
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 p-4 glass-card hover:border-vc-purple/40 transition-all group"
                >
                  <Camera className="w-8 h-8 text-vc-purple-light group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-white/70">Take Photo</span>
                  <span className="text-[10px] text-white/40">Opens camera</span>
                </button>

                {/* Upload button */}
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 p-4 glass-card hover:border-vc-teal/40 transition-all group"
                >
                  <Upload className="w-8 h-8 text-vc-teal group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-white/70">Upload Image</span>
                  <span className="text-[10px] text-white/40">From files</span>
                </button>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* ─── PROCESSING STATE ─── */}
          {panelState === 'processing' && (
            <div className="flex flex-col items-center gap-4 py-8">
              {thumbnailUrl && (
                <img
                  src={thumbnailUrl}
                  alt="Uploaded sheet"
                  className="w-32 h-32 object-cover rounded-lg border border-white/10"
                />
              )}
              <div className="flex items-center gap-2 text-vc-purple-light">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-bold">Reading handwriting...</span>
              </div>
              <p className="text-[10px] text-white/40 text-center">
                This may take a few seconds
              </p>
            </div>
          )}

          {/* ─── REVIEW STATE ─── */}
          {panelState === 'review' && (
            <div className="space-y-3">
              {/* Thumbnail */}
              {thumbnailUrl && (
                <div className="flex items-start gap-3">
                  <img
                    src={thumbnailUrl}
                    alt="Scanned sheet"
                    className="w-16 h-16 object-cover rounded-lg border border-white/10 shrink-0"
                  />
                  <div className="text-xs text-white/50 leading-relaxed">
                    Review the extracted contacts below. Edit any errors and uncheck rows you don&apos;t want to import.
                  </div>
                </div>
              )}

              {/* Contact rows */}
              <div className="space-y-2 max-h-[50dvh] overflow-y-auto">
                {contacts.map((contact, idx) => (
                  <div
                    key={idx}
                    className={clsx(
                      'glass-row p-3 space-y-2',
                      !contact.included && 'opacity-40',
                    )}
                  >
                    {/* Row header: checkbox + name + delete */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={contact.included}
                        onChange={e => updateContact(idx, 'included', e.target.checked)}
                        className="w-4 h-4 rounded accent-vc-purple"
                      />
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={contact.firstName}
                          onChange={e => updateContact(idx, 'firstName', e.target.value)}
                          placeholder="First name"
                          className="glass-input px-2 py-1 text-xs rounded"
                        />
                        <input
                          type="text"
                          value={contact.lastName}
                          onChange={e => updateContact(idx, 'lastName', e.target.value)}
                          placeholder="Last name"
                          className="glass-input px-2 py-1 text-xs rounded"
                        />
                      </div>
                      <button
                        onClick={() => removeContact(idx)}
                        className="text-white/20 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Extra fields */}
                    {contact.included && (
                      <div className="grid grid-cols-2 gap-2 pl-6">
                        <input
                          type="text"
                          value={contact.phone || ''}
                          onChange={e => updateContact(idx, 'phone', e.target.value)}
                          placeholder="Phone"
                          className="glass-input px-2 py-1 text-xs rounded"
                        />
                        <input
                          type="text"
                          value={contact.city || ''}
                          onChange={e => updateContact(idx, 'city', e.target.value)}
                          placeholder="City"
                          className="glass-input px-2 py-1 text-xs rounded"
                        />
                        <select
                          value={contact.category}
                          onChange={e =>
                            updateContact(idx, 'category', e.target.value)
                          }
                          className="glass-input px-2 py-1 text-xs rounded col-span-2"
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
                          className="glass-input px-2 py-1 text-xs rounded"
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
                          className="glass-input px-2 py-1 text-xs rounded"
                        >
                          {VOLUNTEER_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {contact.notes && (
                          <p className="text-[10px] text-white/40 col-span-2 italic">
                            AI notes: {contact.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Import bar */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <p className="text-xs text-white/50 font-display tabular-nums">
                  {includedCount} of {contacts.length} selected
                </p>
                <button
                  onClick={handleImport}
                  disabled={includedCount === 0}
                  className={clsx(
                    'px-5 py-2 rounded-btn text-sm font-bold transition-all',
                    includedCount > 0
                      ? 'bg-vc-purple text-white hover:bg-vc-purple-light shadow-glow'
                      : 'bg-white/10 text-white/30 cursor-not-allowed',
                  )}
                >
                  Import {includedCount} {includedCount === 1 ? 'Contact' : 'Contacts'}
                </button>
              </div>
            </div>
          )}

          {/* ─── DONE STATE ─── */}
          {panelState === 'done' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-12 h-12 rounded-full bg-vc-teal/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-vc-teal" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-white">
                  {importedCount} {importedCount === 1 ? 'contact' : 'contacts'} imported!
                </p>
                <p className="text-xs text-white/40 mt-1">
                  They&apos;ve been added to your rolodex.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-btn text-xs font-bold glass hover:border-white/20 text-white/60 hover:text-white transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Scan Another
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-btn text-xs font-bold bg-vc-purple text-white hover:bg-vc-purple-light shadow-glow transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
