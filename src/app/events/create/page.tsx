'use client'

import { useAuth } from '@/context/AuthContext'
import EventForm from '@/components/events/EventForm'
import Link from 'next/link'
import { ArrowLeft, Lock } from 'lucide-react'

export default function CreateEventPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="glass-card p-8 animate-pulse">
          <div className="h-8 bg-white/5 rounded w-1/3 mb-4" />
          <div className="h-5 bg-white/5 rounded w-2/3" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <Lock className="w-12 h-12 text-white/30 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-bold text-white mb-2">Sign in to create events</h2>
        <p className="text-white/50 mb-6">You need an account with an active events subscription to create events.</p>
        <Link
          href="/sign-in?product=events"
          className="inline-flex bg-vc-purple hover:bg-vc-purple-light text-white px-6 py-3 rounded-btn font-medium shadow-glow transition-all"
        >
          Sign In
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to events
        </Link>
        <h1 className="font-display text-3xl font-bold text-white">Create Event</h1>
        <p className="text-white/50 mt-1">Fill in the details to create a new event.</p>
      </div>

      <EventForm mode="create" />
    </div>
  )
}
