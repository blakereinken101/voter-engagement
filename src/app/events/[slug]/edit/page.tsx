'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import EventForm from '@/components/events/EventForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { EventFormData } from '@/types/events'

export default function EditEventPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const slug = params.slug as string

  const [event, setEvent] = useState<{ id: string; data: Partial<EventFormData> } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/events/${slug}`)
        if (!res.ok) {
          setError('Event not found')
        } else {
          const data = await res.json()
          if (!data.canManage) {
            setError('Not authorized to edit this event')
          } else {
            const e = data.event
            setEvent({
              id: e.id,
              data: {
                title: e.title,
                description: e.description || '',
                eventType: e.eventType,
                startTime: e.startTime ? new Date(e.startTime).toISOString().slice(0, 16) : '',
                endTime: e.endTime ? new Date(e.endTime).toISOString().slice(0, 16) : '',
                timezone: e.timezone,
                locationName: e.locationName || '',
                locationAddress: e.locationAddress || '',
                locationCity: e.locationCity || '',
                locationState: e.locationState || '',
                locationZip: e.locationZip || '',
                isVirtual: e.isVirtual,
                virtualUrl: e.virtualUrl || '',
                coverImageUrl: e.coverImageUrl || '',
                emoji: e.emoji,
                themeColor: e.themeColor,
                visibility: e.visibility,
                maxAttendees: e.maxAttendees?.toString() || '',
                rsvpEnabled: e.rsvpEnabled,
                status: e.status,
              },
            })
          }
        }
      } catch {
        setError('Failed to load event')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [slug])

  if (isLoading || authLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="glass-card p-8 animate-pulse">
          <div className="h-8 bg-white/5 rounded w-1/3 mb-4" />
          <div className="h-[200px] bg-white/5 rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">😕</div>
        <h2 className="font-display text-2xl font-bold text-white mb-2">{error}</h2>
        <Link
          href="/events"
          className="inline-flex mt-4 bg-vc-purple hover:bg-vc-purple-light text-white px-6 py-3 rounded-btn font-medium transition-all"
        >
          Browse Events
        </Link>
      </div>
    )
  }

  if (!event) return null

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link href={`/events/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to event
        </Link>
        <h1 className="font-display text-3xl font-bold text-white">Edit Event</h1>
      </div>

      <EventForm mode="edit" eventId={event.id} initialData={event.data} />
    </div>
  )
}
