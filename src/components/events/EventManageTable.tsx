'use client'

import { useState } from 'react'
import Link from 'next/link'
import EventTypeChip from './EventTypeChip'
import type { Event, EventType } from '@/types/events'
import { Edit, Trash2, Copy, ExternalLink, Users, MoreHorizontal } from 'lucide-react'

interface Props {
  events: Event[]
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}

function formatDate(dateStr: string, timezone?: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  })
}

export default function EventManageTable({ events, onDelete, onDuplicate }: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  if (events.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-white/50">No events yet. Create your first event to get started.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left text-xs font-medium text-white/50 uppercase tracking-wider py-3 px-4">Event</th>
            <th className="text-left text-xs font-medium text-white/50 uppercase tracking-wider py-3 px-4 hidden sm:table-cell">Type</th>
            <th className="text-left text-xs font-medium text-white/50 uppercase tracking-wider py-3 px-4 hidden md:table-cell">Date</th>
            <th className="text-center text-xs font-medium text-white/50 uppercase tracking-wider py-3 px-4">RSVPs</th>
            <th className="text-center text-xs font-medium text-white/50 uppercase tracking-wider py-3 px-4">Status</th>
            <th className="text-right text-xs font-medium text-white/50 uppercase tracking-wider py-3 px-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {events.map(event => (
            <tr key={event.id} className="glass-row hover:bg-white/5 transition-colors">
              <td className="py-3 px-4">
                <Link href={`/events/${event.slug}`} className="text-sm font-medium text-white hover:text-vc-purple-light transition-colors">
                  {event.title}
                </Link>
                <div className="text-xs text-white/40 sm:hidden mt-0.5">
                  {formatDate(event.startTime, event.timezone)}
                </div>
              </td>
              <td className="py-3 px-4 hidden sm:table-cell">
                <EventTypeChip type={event.eventType as EventType} />
              </td>
              <td className="py-3 px-4 text-sm text-white/60 hidden md:table-cell">
                {formatDate(event.startTime, event.timezone)}
              </td>
              <td className="py-3 px-4 text-center">
                <div className="flex items-center justify-center gap-1 text-sm">
                  <Users className="w-3.5 h-3.5 text-vc-teal" />
                  <span className="text-vc-teal font-medium">{event.rsvpCounts?.going || 0}</span>
                  {(event.rsvpCounts?.maybe || 0) > 0 && (
                    <span className="text-white/40">/ {event.rsvpCounts?.maybe} maybe</span>
                  )}
                </div>
              </td>
              <td className="py-3 px-4 text-center">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  event.status === 'published' ? 'bg-vc-teal/15 text-vc-teal' :
                  event.status === 'draft' ? 'bg-white/10 text-white/60' :
                  'bg-vc-coral/15 text-vc-coral'
                }`}>
                  {event.status}
                </span>
              </td>
              <td className="py-3 px-4 text-right relative">
                <button
                  onClick={() => setOpenMenuId(openMenuId === event.id ? null : event.id)}
                  className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {openMenuId === event.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                    <div className="absolute right-4 top-full z-50 bg-vc-surface border border-white/10 rounded-card shadow-cosmic-lg py-1 min-w-[160px] animate-fade-in">
                      <Link
                        href={`/events/${event.slug}`}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
                        onClick={() => setOpenMenuId(null)}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View
                      </Link>
                      <Link
                        href={`/events/${event.slug}/edit`}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
                        onClick={() => setOpenMenuId(null)}
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Edit
                      </Link>
                      <button
                        onClick={() => { onDuplicate(event.id); setOpenMenuId(null) }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white w-full text-left"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Duplicate
                      </button>
                      <div className="border-t border-white/10 my-1" />
                      <button
                        onClick={() => { onDelete(event.id); setOpenMenuId(null) }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-vc-coral hover:bg-vc-coral/5 w-full text-left"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
