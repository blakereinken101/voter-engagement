'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { compressImage } from '@/lib/image-compress'
import { Camera, Upload, X, Loader2, FileSignature } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
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

type PanelState = 'idle' | 'processing'

interface ScanSheetPanelProps {
  onClose: () => void
}

export default function ScanSheetPanel({ onClose }: ScanSheetPanelProps) {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const [panelState, setPanelState] = useState<PanelState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [petitionMode, setPetitionMode] = useState(false)

  // Lock body scroll when panel is open — iOS-safe pattern
  useEffect(() => {
    const scrollY = window.scrollY
    const body = document.body
    const origPosition = body.style.position
    const origTop = body.style.top
    const origWidth = body.style.width
    const origOverflow = body.style.overflow

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'

    return () => {
      body.style.position = origPosition
      body.style.top = origTop
      body.style.width = origWidth
      body.style.overflow = origOverflow
      window.scrollTo(0, scrollY)
    }
  }, [])

  const handleImageSelected = useCallback(async (file: File) => {
    setError(null)
    setPanelState('processing')

    try {
      // Compress the image
      const { base64, mimeType } = await compressImage(file)

      // Create thumbnail for display
      const thumb = `data:${mimeType};base64,${base64}`
      setThumbnailUrl(thumb)

      // Send to API
      const response = await fetch('/api/ai/scan-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType, ...(petitionMode ? { mode: 'petition' } : {}) }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to scan image')
      }

      const data = await response.json()

      // ── Petition mode: stash signatures and navigate to petition review ──
      if (petitionMode) {
        const signatures = data.signatures || []
        if (signatures.length === 0) {
          setError('No signatures found in the image. Try a clearer photo or different angle.')
          setPanelState('idle')
          return
        }
        sessionStorage.setItem('petition-sheet-signatures', JSON.stringify(signatures))
        sessionStorage.setItem('petition-sheet-thumbnail', thumb)
        if (data.petitionerName) {
          sessionStorage.setItem('petition-sheet-petitioner', data.petitionerName)
        }
        if (data.date) {
          sessionStorage.setItem('petition-sheet-date', data.date)
        }
        onClose()
        router.push('/dashboard/petition')
        return
      }

      // ── Contact sheet mode (existing flow) ──
      // Stash volunteer name if OCR detected one (for admin data entry mode)
      if (data.volunteerName) {
        sessionStorage.setItem('scan-sheet-volunteer-name', data.volunteerName)
      } else {
        sessionStorage.removeItem('scan-sheet-volunteer-name')
      }

      const extracted: ExtractedContact[] = (data.contacts || []).map(
        (c: { firstName: string; lastName: string; phone?: string; city?: string; address?: string; zip?: string; notes?: string; category?: string; supportStatus?: string; volunteerInterest?: string }) => ({
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          city: c.city,
          address: c.address,
          zip: c.zip,
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

      // Stash extracted contacts and navigate to full-screen review page
      sessionStorage.setItem('scan-sheet-contacts', JSON.stringify(extracted))
      sessionStorage.setItem('scan-sheet-thumbnail', thumb)
      onClose()
      router.push('/dashboard/scan')
    } catch (err) {
      console.error('[ScanSheet] Error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPanelState('idle')
    }
  }, [onClose, router, petitionMode])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleImageSelected(file)
      // Reset input so the same file can be re-selected
      e.target.value = ''
    },
    [handleImageSelected],
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={panelState === 'idle' ? onClose : undefined} style={{ touchAction: 'none' }} />

      {/* Panel */}
      <div className="relative w-full max-w-lg md:h-auto max-h-[85dvh] flex flex-col overscroll-contain glass-card mx-0 md:mx-4 rounded-t-2xl md:rounded-b-2xl animate-slide-up">
        {/* Header */}
        <div className="shrink-0 z-10 glass-dark flex items-center justify-between px-4 py-4 border-b border-white/10 rounded-t-2xl safe-top">
          <div>
            <h2 className="text-sm font-bold text-white">
              {petitionMode ? 'Scan Petition Sheet' : 'Scan Contact Sheet'}
            </h2>
            <p className="text-[10px] text-white/40">
              {panelState === 'idle' && 'Take a photo or upload an image'}
              {panelState === 'processing' && (petitionMode ? 'Reading petition signatures...' : 'Reading handwriting...')}
            </p>
          </div>
          {panelState === 'idle' && (
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/60 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
          {/* Error */}
          {error && (
            <div className="glass-card border-red-500/20 bg-red-950/30 rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-red-400 text-xs font-bold">!</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-red-300/90 mb-0.5">Couldn&apos;t process image</p>
                <p className="text-[11px] text-white/50 leading-relaxed">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-white/20 hover:text-white/50 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ─── IDLE STATE ─── */}
          {panelState === 'idle' && (
            <div className="space-y-3 safe-bottom">
              {/* Petition mode toggle — admin only */}
              {isAdmin && (
                <div className="flex items-center gap-2 p-2 rounded-lg glass-card border border-white/10">
                  <button
                    onClick={() => setPetitionMode(false)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-bold transition-all ${
                      !petitionMode
                        ? 'bg-vc-purple text-white shadow-glow'
                        : 'text-white/50 hover:text-white/70'
                    }`}
                  >
                    Contact Sheet
                  </button>
                  <button
                    onClick={() => setPetitionMode(true)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-bold transition-all ${
                      petitionMode
                        ? 'bg-emerald-600 text-white'
                        : 'text-white/50 hover:text-white/70'
                    }`}
                  >
                    <FileSignature className="w-3.5 h-3.5" />
                    Petition Sheet
                  </button>
                </div>
              )}

              <p className="text-xs text-white/60 leading-relaxed">
                {petitionMode
                  ? 'Photograph a petition sheet and AI will extract signatures, addresses, and dates.'
                  : 'Photograph a handwritten contact sheet and AI will extract the names and details for you.'}
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
            <div className="flex flex-col items-center gap-4 py-8 safe-bottom">
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
        </div>
      </div>
    </div>
  )
}
