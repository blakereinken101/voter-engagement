'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Trophy, MessageSquare, BookOpen, UserPlus, ThumbsUp, User, Users, MapPin, CalendarCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import MetricTooltip from './MetricTooltip'
import clsx from 'clsx'

type Metric = 'conversations' | 'contactsRolodexed' | 'supporters' | 'volInterest' | 'shiftsCompleted' | 'recruited'
type Entity = 'volunteer' | 'organizer' | 'region'

interface VolunteerStat {
  id: string
  name: string
  organizerName: string
  region: string
  conversations: number
  contactsRolodexed: number
  supporters: number
  volInterest: number
  shiftsCompleted: number
  recruited: number
}

interface LeaderboardData {
  period: string
  timezone: string
  periodLabel: string
  dateRange: string
  volunteers: VolunteerStat[]
}

interface AggregatedEntry {
  id: string
  name: string
  subtitle: string
  conversations: number
  contactsRolodexed: number
  supporters: number
  volInterest: number
  shiftsCompleted: number
  recruited: number
  rank: number
}

interface MetricDef {
  id: Metric
  label: string
  short: string
  tooltip: string
  icon: LucideIcon
  color: string
}

const METRICS: MetricDef[] = [
  { id: 'conversations', label: 'Conversations', short: 'Convos', tooltip: 'Number of voter conversations logged this period.', icon: MessageSquare, color: 'text-vc-blue-light' },
  { id: 'contactsRolodexed', label: 'Added', short: 'Added', tooltip: 'Contacts added by the volunteer through the relational program.', icon: BookOpen, color: 'text-vc-teal' },
  { id: 'supporters', label: 'Supporters IDed', short: 'Supporters', tooltip: 'Contacts identified as supporters during outreach.', icon: ThumbsUp, color: 'text-emerald-400' },
  { id: 'volInterest', label: 'Vol. Recruits', short: 'Recruits', tooltip: 'Contacts who said yes to volunteering.', icon: UserPlus, color: 'text-blue-400' },
  { id: 'shiftsCompleted', label: 'Shifts', short: 'Shifts', tooltip: 'Volunteer shifts completed (events attended).', icon: CalendarCheck, color: 'text-amber-400' },
  { id: 'recruited', label: 'Recruited', short: 'Recruited', tooltip: 'New volunteers recruited by this person.', icon: Users, color: 'text-purple-400' },
]

const ENTITIES: { id: Entity; label: string; icon: LucideIcon }[] = [
  { id: 'volunteer', label: 'Volunteers', icon: User },
  { id: 'organizer', label: 'Organizers', icon: Users },
  { id: 'region', label: 'Regions', icon: MapPin },
]

export default function PtgLeaderboard({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'weekly' | 'daily'>('weekly')
  const [entity, setEntity] = useState<Entity>('volunteer')
  const [metric, setMetric] = useState<Metric>('conversations')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ptg/leaderboard?period=${period}`)
      if (res.ok) {
        setData(await res.json())
      }
    } catch {
      // silent failure
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData, refreshKey])

  const aggregatedData = useMemo((): AggregatedEntry[] => {
    if (!data?.volunteers) return []
    let result: Omit<AggregatedEntry, 'rank'>[] = []

    if (entity === 'volunteer') {
      result = data.volunteers.map(v => ({
        id: v.id,
        name: v.name,
        subtitle: v.organizerName || v.region,
        conversations: v.conversations,
        contactsRolodexed: v.contactsRolodexed,
        supporters: v.supporters,
        volInterest: v.volInterest,
        shiftsCompleted: v.shiftsCompleted || 0,
        recruited: v.recruited || 0,
      }))
    } else {
      const key = entity === 'organizer' ? 'organizerName' : 'region'
      const subtitleLabel = entity === 'region' ? 'Region' : ''
      const map = new Map<string, Omit<AggregatedEntry, 'rank'>>()
      data.volunteers.forEach(v => {
        const k = v[key] || 'Unassigned'
        if (!map.has(k)) {
          const subtitle = entity === 'organizer' ? (v.region || '') : subtitleLabel
          map.set(k, { id: k, name: k, subtitle, conversations: 0, contactsRolodexed: 0, supporters: 0, volInterest: 0, shiftsCompleted: 0, recruited: 0 })
        }
        const entry = map.get(k)!
        entry.conversations += v.conversations
        entry.contactsRolodexed += v.contactsRolodexed
        entry.supporters += v.supporters
        entry.volInterest += v.volInterest
        entry.shiftsCompleted += (v.shiftsCompleted || 0)
        entry.recruited += (v.recruited || 0)
      })
      result = Array.from(map.values())
    }

    return result
      .sort((a, b) => {
        if (b[metric] !== a[metric]) return b[metric] - a[metric]
        if (metric !== 'conversations' && b.conversations !== a.conversations) return b.conversations - a.conversations
        if (b.contactsRolodexed !== a.contactsRolodexed) return b.contactsRolodexed - a.contactsRolodexed
        return a.name.localeCompare(b.name)
      })
      .map((item, index) => ({ ...item, rank: index + 1 }))
  }, [data, entity, metric])

  const getRankStyle = (rank: number, index: number) => {
    if (rank === 1) return 'bg-amber-400/10 text-amber-300 border-amber-400/20'
    if (rank === 2) return 'bg-gray-300/10 text-gray-200 border-gray-300/20'
    if (rank === 3) return 'bg-orange-400/10 text-orange-300 border-orange-400/20'
    return index % 2 === 0
      ? 'bg-white/[0.04] text-white/70 border-white/[0.06] hover:bg-white/[0.06]'
      : 'bg-white/[0.02] text-white/70 border-transparent hover:bg-white/[0.04]'
  }

  const getRankIcon = (rank: number) => {
    if (rank <= 3) return <Trophy className={clsx('w-4 h-4', rank === 1 && 'text-amber-300', rank === 2 && 'text-gray-300', rank === 3 && 'text-orange-300')} />
    return <span className="text-sm tabular-nums font-bold">{rank}</span>
  }

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-lg font-bold text-white">Leaderboard</h3>
            {data && (
              <p className="text-sm text-white/50">
                {data.dateRange || data.periodLabel}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
           {/* Entity Tabs */}
           <div className="flex p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
             {ENTITIES.map(e => {
               const Icon = e.icon
               return (
                 <button
                   key={e.id}
                   onClick={() => setEntity(e.id)}
                   className={clsx(
                     "flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-md transition-all whitespace-nowrap",
                     entity === e.id
                       ? "bg-white/10 text-white shadow-sm"
                       : "text-white/50 hover:text-white/70"
                   )}
                 >
                   <Icon className="w-3.5 h-3.5" />
                   {e.label}
                 </button>
               )
             })}
           </div>
           {/* Period Toggle */}
           <div className="flex p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              <button
                onClick={() => setPeriod('weekly')}
                className={clsx(
                  'px-3 py-2 text-sm font-semibold rounded-md transition-all',
                  period === 'weekly' ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white/70'
                )}
              >
                Weekly
              </button>
              <button
                onClick={() => setPeriod('daily')}
                className={clsx(
                  'px-3 py-2 text-sm font-semibold rounded-md transition-all',
                  period === 'daily' ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:text-white/70'
                )}
              >
                Today
              </button>
           </div>
        </div>
      </div>

      {/* List Area */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-1.5 space-y-0.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={clsx(
                  'grid items-center px-3 py-2.5 rounded-lg border gap-3',
                  'grid-cols-[40px_1fr_80px] md:grid-cols-[44px_1fr_repeat(6,minmax(80px,1fr))]',
                  i % 2 === 0 ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-white/[0.02] border-transparent'
                )}
              >
                <div className="flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-white/[0.06] animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3.5 bg-white/[0.06] rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                  <div className="h-2.5 w-20 bg-white/[0.04] rounded animate-pulse" />
                </div>
                <div className="md:hidden flex justify-end">
                  <div className="h-5 w-10 bg-white/[0.06] rounded animate-pulse" />
                </div>
                {METRICS.map(m => (
                  <div key={m.id} className="hidden md:flex justify-end">
                    <div className="h-5 w-10 bg-white/[0.06] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : !data || aggregatedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Trophy className="w-12 h-12 text-white/5 mb-3" />
            <p className="text-white/60 font-medium">No activity recorded {period === 'weekly' ? 'this week' : 'today'} yet.</p>
            <p className="text-white/40 text-sm mt-1">As volunteers log conversations this period, they will appear here ranked by their activity.</p>
          </div>
        ) : (
          <div>
              {/* Table Header — click columns to sort by metric */}
              <div className="hidden md:grid grid-cols-[44px_1fr_repeat(6,minmax(80px,1fr))] gap-3 px-4 py-3 text-xs font-bold text-white/50 uppercase tracking-wider border-b border-white/[0.08] bg-white/[0.04]">
                <div className="text-center">#</div>
                <div>{ENTITIES.find(e => e.id === entity)?.label.slice(0, -1)}</div>
                {METRICS.map(m => {
                  const Icon = m.icon
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMetric(m.id)}
                      className={clsx(
                        "text-right flex items-center justify-end gap-1 transition-colors group outline-none",
                        metric === m.id ? m.color : "hover:text-white/70"
                      )}
                    >
                      <Icon className={clsx("w-3.5 h-3.5 transition-transform", metric === m.id && "scale-110")} />
                      <span className={clsx("text-xs", metric === m.id && "underline underline-offset-4 decoration-2 decoration-current/30")}>
                        {m.short}
                      </span>
                      <MetricTooltip text={m.tooltip} />
                    </button>
                  )
                })}
              </div>

              {/* Rows */}
              <div className="p-1.5 space-y-0.5">
                {aggregatedData.map((entry, idx) => {
                  const selectedMetric = METRICS.find(m => m.id === metric)!
                  const selectedVal = entry[metric]
                  return (
                  <div
                    key={`${entity}-${entry.id}`}
                    className={clsx(
                      'grid items-center px-3 py-2.5 rounded-lg border transition-all gap-3',
                      'grid-cols-[40px_1fr_80px] md:grid-cols-[44px_1fr_repeat(6,minmax(80px,1fr))]',
                      getRankStyle(entry.rank, idx)
                    )}
                  >
                    <div className="flex items-center justify-center">
                       <div className={clsx(
                         "flex items-center justify-center w-8 h-8 rounded-full border",
                         entry.rank <= 3 ? "border-current/30 bg-black/20" : "border-white/10 bg-white/5"
                       )}>
                         {getRankIcon(entry.rank)}
                       </div>
                    </div>

                    <div className="min-w-0 pr-2">
                      <p className={clsx(
                        'font-bold truncate leading-tight',
                        entry.rank <= 3 ? 'text-[15px] text-white' : 'text-[15px] text-white/90',
                      )}>
                        {entry.name}
                      </p>
                      <p className="text-xs text-white/50 truncate mt-0.5">
                        {entry.subtitle}
                      </p>
                    </div>

                    {/* Mobile: only show the selected metric */}
                    <div className="md:hidden text-right flex flex-col items-end justify-center">
                      <span className={clsx(
                        "text-xl tabular-nums font-bold",
                        selectedVal > 0 ? selectedMetric.color : 'text-white/30'
                      )}>
                        {selectedVal.toLocaleString()}
                      </span>
                      <span className="text-xs text-white/50">{selectedMetric.short}</span>
                    </div>

                    {/* Desktop: all metrics */}
                    {METRICS.map(m => {
                      const val = entry[m.id]
                      const isSortedByThis = metric === m.id
                      return (
                        <div key={m.id} className="hidden md:flex text-right flex-col items-end justify-center">
                          <span className={clsx(
                            "text-lg tabular-nums font-bold",
                            isSortedByThis
                              ? (val > 0 ? m.color : 'text-white/30')
                              : (val > 0 ? 'text-white/80' : 'text-white/15')
                          )}>
                            {val.toLocaleString()}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  )
                })}
              </div>
          </div>
        )}
      </div>
    </div>
  )
}
