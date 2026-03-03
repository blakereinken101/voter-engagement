'use client'

interface EventRsvp {
  eventId: string
  eventTitle: string
  status: string
  startTime: string
}

interface Props {
  rsvps?: EventRsvp[]
}

export default function EventRsvpBadges({ rsvps }: Props) {
  if (!rsvps || rsvps.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {rsvps.map(r => {
        const date = new Date(r.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const statusColor = r.status === 'yes'
          ? 'bg-vc-teal/20 text-vc-teal'
          : r.status === 'maybe'
          ? 'bg-amber-500/20 text-amber-300'
          : 'bg-white/10 text-white/40'
        return (
          <span key={r.eventId} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor}`}>
            {r.eventTitle} {date}: {r.status.toUpperCase()}
          </span>
        )
      })}
    </div>
  )
}
