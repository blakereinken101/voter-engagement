import { getDb } from '@/lib/db'
import { mapEventRow } from '@/lib/events'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, MapPin, Globe, ArrowRight, Users } from 'lucide-react'

interface Props {
  params: { accountname: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const db = await getDb()
  const { rows } = await db.query('SELECT name, description FROM organizations WHERE slug = $1', [params.accountname])
  if (rows.length === 0) return { title: 'Account Not Found' }
  return {
    title: `${rows[0].name} Events`,
    description: rows[0].description || `Upcoming events from ${rows[0].name}`,
  }
}

export default async function AccountPage({ params }: Props) {
  const db = await getDb()

  const { rows: orgRows } = await db.query(
    'SELECT id, name, slug, description, logo_url FROM organizations WHERE slug = $1',
    [params.accountname]
  )

  if (orgRows.length === 0) {
    notFound()
  }

  const org = orgRows[0]

  // Get published public events
  const { rows: eventRows } = await db.query(`
    SELECT e.*,
           u.name as creator_name,
           o.name as org_name,
           COALESCE(going.cnt, 0) as going_count,
           COALESCE(maybe.cnt, 0) as maybe_count,
           COALESCE(notgoing.cnt, 0) as not_going_count
    FROM events e
    LEFT JOIN users u ON u.id = e.created_by
    LEFT JOIN organizations o ON o.id = e.organization_id
    LEFT JOIN LATERAL (SELECT COUNT(*) as cnt FROM event_rsvps WHERE event_id = e.id AND status = 'going') going ON true
    LEFT JOIN LATERAL (SELECT COUNT(*) as cnt FROM event_rsvps WHERE event_id = e.id AND status = 'maybe') maybe ON true
    LEFT JOIN LATERAL (SELECT COUNT(*) as cnt FROM event_rsvps WHERE event_id = e.id AND status = 'not_going') notgoing ON true
    WHERE e.organization_id = $1
      AND e.status = 'published'
      AND e.visibility = 'public'
    ORDER BY e.start_time ASC
  `, [org.id])

  const allEvents = eventRows.map(mapEventRow)
  const now = new Date()
  const upcoming = allEvents.filter(e => new Date(e.startTime) >= now)
  const past = allEvents.filter(e => new Date(e.startTime) < now)

  return (
    <div className="min-h-screen bg-vc-bg">
      {/* Header */}
      <nav className="border-b border-white/10 bg-vc-bg/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/events" className="flex items-center gap-2">
            <span className="text-lg">🗳️</span>
            <span className="font-display font-bold text-white hidden sm:inline">Threshold Events</span>
          </Link>
          <Link
            href="/sign-in"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            Sign In
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        {/* Org Header */}
        <div className="text-center mb-12">
          {org.logo_url && (
            <img src={org.logo_url} alt={org.name} className="w-20 h-20 rounded-full mx-auto mb-4 object-cover ring-2 ring-white/10" />
          )}
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mb-2">{org.name}</h1>
          {org.description && (
            <p className="text-white/50 max-w-xl mx-auto">{org.description}</p>
          )}
          <div className="flex items-center justify-center gap-1 mt-3 text-white/30 text-sm">
            <Globe className="w-3.5 h-3.5" />
            <span>thresholdvote.com/{org.slug}</span>
          </div>
        </div>

        {/* Upcoming Events */}
        {upcoming.length > 0 ? (
          <div className="mb-16">
            <h2 className="font-display text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-vc-purple-light" />
              Upcoming Events
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcoming.map(event => (
                <Link key={event.id} href={`/events/${event.slug}`} className="glass-card p-5 hover:ring-1 hover:ring-vc-purple/40 transition-all group">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{event.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white group-hover:text-vc-purple-light transition-colors truncate">{event.title}</h3>
                      <p className="text-white/40 text-sm mt-1">
                        {new Date(event.startTime).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-white/30">
                        {event.locationCity && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.locationCity}{event.locationState ? `, ${event.locationState}` : ''}
                          </span>
                        )}
                        {event.isVirtual && (
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            Virtual
                          </span>
                        )}
                        {event.rsvpCounts && event.rsvpCounts.going > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {event.rsvpCounts.going} going
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-vc-purple-light transition-colors flex-shrink-0 mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 glass-card mb-16">
            <Calendar className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <h3 className="text-white/60 font-medium mb-1">No upcoming events</h3>
            <p className="text-white/30 text-sm">Check back soon for new events from {org.name}</p>
          </div>
        )}

        {/* Past Events */}
        {past.length > 0 && (
          <div className="opacity-60">
            <h2 className="font-display text-lg font-bold text-white/60 mb-4">Past Events</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {past.map(event => (
                <Link key={event.id} href={`/events/${event.slug}`} className="glass-card p-4 hover:ring-1 hover:ring-white/10 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="text-lg">{event.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white/70 truncate">{event.title}</h3>
                      <p className="text-white/30 text-xs mt-0.5">
                        {new Date(event.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
