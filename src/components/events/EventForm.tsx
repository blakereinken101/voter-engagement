'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { EVENT_TYPE_CONFIG } from '@/types/events'
import type { EventType, EventFormData, EventVisibility, EventStatus } from '@/types/events'
import EventCoverImage from './EventCoverImage'
import { Save, Eye, Globe, Lock, Users, Upload, X } from 'lucide-react'

interface Props {
  initialData?: Partial<EventFormData>
  eventId?: string  // If editing
  mode: 'create' | 'edit'
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
]

const EMOJI_OPTIONS = ['🗳️', '📢', '🎉', '🤝', '🔥', '💪', '🇺🇸', '🏛️', '📞', '🚪', '🍻', '📺', '💰', '📋', '🌟', '❤️']

function snapTo15Minutes(datetime: string): string {
  if (!datetime) return datetime
  const [datePart, timePart] = datetime.split('T')
  if (!timePart) return datetime
  const [hours, minutes] = timePart.split(':').map(Number)
  const snapped = Math.round(minutes / 15) * 15
  const finalMinutes = snapped === 60 ? 0 : snapped
  const finalHours = snapped === 60 ? hours + 1 : hours
  return `${datePart}T${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`
}

export default function EventForm({ initialData, eventId, mode }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<EventFormData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    eventType: initialData?.eventType || 'community',
    startTime: initialData?.startTime || '',
    endTime: initialData?.endTime || '',
    timezone: initialData?.timezone || 'America/New_York',
    locationName: initialData?.locationName || '',
    locationAddress: initialData?.locationAddress || '',
    locationCity: initialData?.locationCity || '',
    locationState: initialData?.locationState || '',
    locationZip: initialData?.locationZip || '',
    isVirtual: initialData?.isVirtual || false,
    virtualUrl: initialData?.virtualUrl || '',
    coverImageUrl: initialData?.coverImageUrl || '',
    emoji: initialData?.emoji || '🗳️',
    themeColor: initialData?.themeColor || '#6C3CE1',
    visibility: initialData?.visibility || 'public',
    maxAttendees: initialData?.maxAttendees || '',
    rsvpEnabled: initialData?.rsvpEnabled !== false,
    status: initialData?.status || 'published',
  })

  function updateForm(updates: Partial<EventFormData>) {
    setForm(prev => ({ ...prev, ...updates }))
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, WebP, etc.)')
      return
    }

    // Limit to 2MB
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB. Try compressing it first.')
      return
    }

    setUploadingImage(true)
    setError('')

    const reader = new FileReader()
    reader.onload = () => {
      updateForm({ coverImageUrl: reader.result as string })
      setUploadingImage(false)
    }
    reader.onerror = () => {
      setError('Failed to read image file')
      setUploadingImage(false)
    }
    reader.readAsDataURL(file)

    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const url = mode === 'create' ? '/api/events' : `/api/events/${eventId}`
      const method = mode === 'create' ? 'POST' : 'PUT'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save event')
        return
      }

      const data = await res.json()
      router.push(`/events/${data.slug || eventId}`)
    } catch {
      setError('Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const eventTypes = Object.entries(EVENT_TYPE_CONFIG) as [EventType, typeof EVENT_TYPE_CONFIG[EventType]][]

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Preview */}
      <div className="rounded-card overflow-hidden">
        <EventCoverImage
          coverImageUrl={form.coverImageUrl || null}
          emoji={form.emoji}
          themeColor={form.themeColor}
          title={form.title || 'Your Event'}
          size="card"
        />
      </div>

      {/* Basic Info */}
      <section className="glass-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-white">Basic Info</h2>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">Event Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={e => updateForm({ title: e.target.value })}
            placeholder="Spring Canvass on Main Street"
            className="glass-input w-full px-4 py-3 text-white"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={e => updateForm({ description: e.target.value })}
            placeholder="Tell people what this event is about..."
            rows={4}
            className="glass-input w-full px-4 py-3 text-white resize-none"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">Event Type *</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {eventTypes.map(([key, config]) => (
              <button
                key={key}
                type="button"
                onClick={() => updateForm({ eventType: key })}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-btn text-sm font-medium border transition-all ${
                  form.eventType === key
                    ? `${config.bgClass} border-current`
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                <span>{config.emoji}</span>
                <span className="truncate">{config.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Date & Time */}
      <section className="glass-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-white">Date & Time</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Start *</label>
            <input
              type="datetime-local"
              value={form.startTime}
              onChange={e => updateForm({ startTime: snapTo15Minutes(e.target.value) })}
              step={900}
              className="glass-input w-full px-4 py-3 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1.5">End</label>
            <input
              type="datetime-local"
              value={form.endTime}
              onChange={e => updateForm({ endTime: snapTo15Minutes(e.target.value) })}
              step={900}
              className="glass-input w-full px-4 py-3 text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">Timezone</label>
          <select
            value={form.timezone}
            onChange={e => updateForm({ timezone: e.target.value })}
            className="glass-input w-full px-4 py-3 text-white bg-transparent"
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz} className="bg-vc-surface">{tz.replace('America/', '').replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Location */}
      <section className="glass-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-white">Location</h2>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isVirtual}
            onChange={e => updateForm({ isVirtual: e.target.checked })}
            className="w-4 h-4 rounded accent-vc-purple"
          />
          <span className="text-sm text-white/80">This is a virtual event</span>
        </label>

        {form.isVirtual ? (
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Virtual Event URL</label>
            <input
              type="text"
              value={form.virtualUrl}
              onChange={e => updateForm({ virtualUrl: e.target.value })}
              placeholder="https://zoom.us/j/..."
              className="glass-input w-full px-4 py-3 text-white"
            />
            <p className="text-xs text-white/40 mt-1">Zoom, Google Meet, or any video call link</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Venue Name</label>
              <input
                type="text"
                value={form.locationName}
                onChange={e => updateForm({ locationName: e.target.value })}
                placeholder="Community Center"
                className="glass-input w-full px-4 py-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Street Address</label>
              <input
                type="text"
                value={form.locationAddress}
                onChange={e => updateForm({ locationAddress: e.target.value })}
                placeholder="123 Main St"
                className="glass-input w-full px-4 py-3 text-white"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">City</label>
                <input
                  type="text"
                  value={form.locationCity}
                  onChange={e => updateForm({ locationCity: e.target.value })}
                  className="glass-input w-full px-4 py-3 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">State</label>
                <input
                  type="text"
                  value={form.locationState}
                  onChange={e => updateForm({ locationState: e.target.value })}
                  className="glass-input w-full px-4 py-3 text-white"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">ZIP</label>
                <input
                  type="text"
                  value={form.locationZip}
                  onChange={e => updateForm({ locationZip: e.target.value })}
                  className="glass-input w-full px-4 py-3 text-white"
                  maxLength={10}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Appearance */}
      <section className="glass-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-white">Appearance</h2>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">Cover Image</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          {form.coverImageUrl ? (
            <div className="relative group">
              <img src={form.coverImageUrl} alt="Cover preview" className="w-full h-32 object-cover rounded-btn border border-white/10" />
              <button
                type="button"
                onClick={() => updateForm({ coverImageUrl: '' })}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white/80 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="w-full flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-white/15 rounded-btn text-sm text-white/50 hover:border-white/30 hover:text-white/70 transition-all disabled:opacity-50"
            >
              <Upload className="w-5 h-5" />
              {uploadingImage ? 'Processing...' : 'Upload cover image'}
            </button>
          )}
          <p className="text-xs text-white/40 mt-1">JPG, PNG, or WebP up to 2MB. Leave empty for a gradient with your emoji.</p>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">Emoji</label>
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map(em => (
              <button
                key={em}
                type="button"
                onClick={() => updateForm({ emoji: em })}
                className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                  form.emoji === em ? 'bg-vc-purple/30 ring-2 ring-vc-purple' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">Theme Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.themeColor}
              onChange={e => updateForm({ themeColor: e.target.value })}
              className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
            />
            <span className="text-sm text-white/60">{form.themeColor}</span>
          </div>
        </div>
      </section>

      {/* Settings */}
      <section className="glass-card p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-white">Settings</h2>

        <div>
          <label className="block text-sm text-white/60 mb-2">Visibility</label>
          <div className="flex flex-col sm:flex-row gap-2">
            {[
              { value: 'public' as EventVisibility, label: 'Public', desc: 'Anyone can discover and RSVP', icon: <Globe className="w-4 h-4" /> },
              { value: 'org' as EventVisibility, label: 'Organization', desc: 'Only org members can see', icon: <Users className="w-4 h-4" /> },
              { value: 'invite_only' as EventVisibility, label: 'Invite Only', desc: 'Only people with the link', icon: <Lock className="w-4 h-4" /> },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateForm({ visibility: opt.value })}
                className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-btn border text-left transition-all ${
                  form.visibility === opt.value
                    ? 'bg-vc-purple/15 border-vc-purple/40 text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                {opt.icon}
                <div>
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs opacity-60">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Max Attendees</label>
            <input
              type="number"
              value={form.maxAttendees}
              onChange={e => updateForm({ maxAttendees: e.target.value })}
              placeholder="Leave empty for unlimited"
              className="glass-input w-full px-4 py-3 text-white"
              min={1}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.rsvpEnabled}
                onChange={e => updateForm({ rsvpEnabled: e.target.checked })}
                className="w-4 h-4 rounded accent-vc-purple"
              />
              <span className="text-sm text-white/80">Enable RSVPs</span>
            </label>
          </div>
        </div>

        {mode === 'edit' && (
          <div>
            <label className="block text-sm text-white/60 mb-2">Status</label>
            <div className="flex gap-2">
              {[
                { value: 'published' as EventStatus, label: 'Published' },
                { value: 'draft' as EventStatus, label: 'Draft' },
                { value: 'cancelled' as EventStatus, label: 'Cancelled' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateForm({ status: opt.value })}
                  className={`px-4 py-2 rounded-btn text-sm font-medium border transition-all ${
                    form.status === opt.value
                      ? opt.value === 'cancelled'
                        ? 'bg-vc-coral/15 border-vc-coral/40 text-vc-coral'
                        : 'bg-vc-purple/15 border-vc-purple/40 text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Submit */}
      {error && (
        <div className="glass-card p-4 border-vc-coral/30 bg-vc-coral/5">
          <p className="text-sm text-vc-coral">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 bg-vc-purple hover:bg-vc-purple-light text-white px-6 py-3 rounded-btn font-medium shadow-glow transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Event' : 'Save Changes'}
        </button>

        {mode === 'create' && (
          <button
            type="button"
            onClick={() => {
              updateForm({ status: 'draft' })
              // Submit as draft
              const form2 = document.querySelector('form')
              form2?.requestSubmit()
            }}
            className="flex items-center gap-2 bg-white/5 border border-white/15 text-white/70 px-6 py-3 rounded-btn font-medium hover:bg-white/10 transition-all"
          >
            <Eye className="w-4 h-4" />
            Save as Draft
          </button>
        )}
      </div>
    </form>
  )
}
