'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Trophy, Loader2, MessageSquare, BookOpen, UserPlus, ThumbsUp, User, Users, MapPin } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

type Metric = 'conversations' | 'contactsRolodexed' | 'supporters' | 'volInterest'
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
}

interface LeaderboardData {
  period: string
  timezone: string
  periodLabel: string
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
  rank: number
}

interface MetricDef {
  id: Metric
  label: string
  short: string
  icon: LucideIcon
  color: string
  bg: string
  border: string
}

const METRICS: MetricDef[] = [
  { id: 'conversations', label: 'Conversations', short: 'Convos', icon: MessageSquare, color: 'text-vc-purple-light', bg: 'bg-vc-purple-light/10', border: 'border-vc-purple-light/30' },
  { id: 'contactsRolodexed', label: 'Rolodexed', short: 'Rolodex', icon: BookOpen, color: 'text-vc-teal', bg: 'bg-vc-teal/10', border: 'border-vc-teal/30' },
  { id: 'supporters', label: 'Supporters', short: 'Support', icon: ThumbsUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  { id: 'volInterest', label: 'Volunteers', short: 'Vol Int', icon: UserPlus, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30' },
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
        subtitle: `${v.organizerName} · ${v.region}`,
        conversations: v.conversations,
        contactsRolodexed: v.contactsRolodexed,
        supporters: v.supporters,
        volInterest: v.volInterest,
      }))
    } else {
      const key = entity === 'organizer' ? 'organizerName' : 'region'
      const subtitleLabel = entity === 'organizer' ? 'Organizer' : 'Region'
      const map = new Map<string, Omit<AggregatedEntry, 'rank'>>()
      data.volunteers.forEach(v => {
        const k = v[key] || 'Unassigned'
        if (!map.has(k)) {
          map.set(k, { id: k, name: k, subtitle: subtitleLabel, conversations: 0, contactsRolodexed: 0, supporters: 0, volInterest: 0 })
        }
        const entry = map.get(k)!
        entry.conversations += v.conversations
        entry.contactsRolodexed += v.contactsRolodexed
        entry.supporters += v.supporters
        entry.volInterest += v.volInterest
      })
      result = Array.from(map.values())
    }

    return result
      .sort((a, b) => {
        if (b[metric] !== a[metric]) return b[metric] - a[metric]
        if (metric !== 'conversations' && b.conversations !== a.conversations) return b.conversations - a.conversations
        return b.contactsRolodexed - a.contactsRolodexed
      })
      .map((item, index) => ({ ...item, rank: index + 1 }))
  }, [data, entity, metric])

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-amber-400/15 text-amber-300 border-amber-400/30 shadow-[0_0_15px_rgba(251,191,36,0.15)] z-10 relative'
    if (rank === 2) return 'bg-gray-300/15 text-gray-200 border-gray-300/30 shadow-[0_0_15px_rgba(209,213,219,0.1)] z-10 relative'
    if (rank === 3) return 'bg-orange-400/15 text-orange-300 border-orange-400/30 shadow-[0_0_15px_rgba(251,146,60,0.1)] z-10 relative'
    return 'bg-white/[0.02] text-white/40 border-white/[0.05] hover:bg-white/[0.04]'
  }

  const getRankIcon = (rank: number) => {
    if (rank <= 3) return <Trophy className={clsx('w-3.5 h-3.5 drop-shadow-md', rank === 1 && 'text-amber-300', rank === 2 && 'text-gray-300', rank === 3 && 'text-orange-300')} />
    return <span className="text-[11px] tabular-nums font-bold">{rank}</span>
  }

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-400/20 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Leaderboard</h3>
            {data && (
              <p className="text-xs text-white/40 font-medium">
                {data.periodLabel} &middot; {data.timezone.replace('America/', '').replace('_', ' ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
           {/* Period Toggle */}
           <div className="flex p-0.5 rounded-lg bg-white/5 border border-white/10">
              <button
                onClick={() => setPeriod('weekly')}
                className={clsx(
                  'px-3 py-1.5 text-xs font-bold rounded-md transition-all',
                  period === 'weekly' ? 'bg-white/15 text-white shadow-sm' : 'text-white/40 hover:text-white/70'
                )}
              >
                Weekly
              </button>
              <button
                onClick={() => setPeriod('daily')}
                className={clsx(
                  'px-3 py-1.5 text-xs font-bold rounded-md transition-all',
                  period === 'daily' ? 'bg-white/15 text-white shadow-sm' : 'text-white/40 hover:text-white/70'
                )}
              >
                Daily
              </button>
           </div>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/20 p-2 rounded-xl border border-white/[0.05]">

         {/* Entity Tabs */}
         <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
           {ENTITIES.map(e => {
             const Icon = e.icon
             return (
               <button
                 key={e.id}
                 onClick={() => setEntity(e.id)}
                 className={clsx(
                   "flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap",
                   entity === e.id
                     ? "bg-white/10 text-white shadow-sm"
                     : "text-white/40 hover:text-white/70 hover:bg-white/5"
                 )}
               >
                 <Icon className="w-4 h-4" />
                 {e.label}
               </button>
             )
           })}
         </div>

          {/* Metric Selectors */}
         <div className="flex flex-wrap gap-1 md:justify-end">
           {METRICS.map(m => {
             const Icon = m.icon
             return (
               <button
                 key={m.id}
                 onClick={() => setMetric(m.id)}
                 className={clsx(
                   "flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all border",
                   metric === m.id
                     ? `${m.bg} ${m.border} ${m.color} shadow-sm`
                     : "bg-transparent border-transparent text-white/30 hover:text-white/60 hover:bg-white/5"
                 )}
               >
                 <Icon className="w-3.5 h-3.5" />
                 {m.label}
               </button>
             )
           })}
         </div>
      </div>

      {/* List Area */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-6 h-6 text-amber-400/50 animate-spin" />
            <span className="text-sm text-white/30 font-medium">Calculating rankings...</span>
          </div>
        ) : !data || aggregatedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Trophy className="w-12 h-12 text-white/5 mb-3" />
            <p className="text-white/40 font-medium">No activity recorded for this {period === 'weekly' ? 'week' : 'day'} yet.</p>
            <p className="text-white/20 text-xs mt-1">Start texting and making calls to appear on the leaderboard!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[540px]">
              {/* Table Header */}
              <div className="grid grid-cols-[50px_1fr_80px_80px_80px_80px] gap-2 px-4 py-3 text-[10px] font-bold text-white/30 uppercase tracking-widest border-b border-white/[0.05] bg-black/20">
                <div className="text-center">Rank</div>
                <div>{ENTITIES.find(e => e.id === entity)?.label.slice(0, -1)}</div>
                {METRICS.map(m => {
                  const Icon = m.icon
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMetric(m.id)}
                      className={clsx(
                        "text-right flex items-center justify-end gap-1.5 transition-colors group outline-none",
                        metric === m.id ? m.color : "hover:text-white/70"
                      )}
                    >
                      <Icon className={clsx("w-3 h-3 transition-transform", metric === m.id && "scale-110")} />
                      <span className={clsx(metric === m.id && "underline underline-offset-4 decoration-2 decoration-current/30")}>
                        {m.short}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Rows */}
              <div className="p-2 space-y-1">
                {aggregatedData.map((entry) => (
                  <div
                    key={entry.id}
                    className={clsx(
                      'grid grid-cols-[50px_1fr_80px_80px_80px_80px] gap-2 items-center px-2 py-2.5 rounded-lg border transition-all',
                      getRankStyle(entry.rank)
                    )}
                  >
                    <div className="flex items-center justify-center">
                       <div className={clsx(
                         "flex items-center justify-center w-7 h-7 rounded-full border",
                         entry.rank <= 3 ? "border-current/30 bg-black/20" : "border-white/10 bg-white/5"
                       )}>
                         {getRankIcon(entry.rank)}
                       </div>
                    </div>

                    <div className="min-w-0 pr-4">
                      <p className={clsx(
                        'text-sm font-bold truncate leading-tight',
                        entry.rank <= 3 ? 'text-white' : 'text-white/90',
                      )}>
                        {entry.name}
                      </p>
                      <p className="text-[10px] text-white/40 truncate mt-0.5 font-medium">
                        {entry.subtitle}
                      </p>
                    </div>

                    {METRICS.map(m => {
                      const val = entry[m.id]
                      const isSortedByThis = metric === m.id
                      return (
                        <div key={m.id} className="text-right flex flex-col items-end justify-center">
                          <span className={clsx(
                            "text-[13px] tabular-nums font-bold",
                            isSortedByThis
                              ? (val > 0 ? m.color : 'text-white/30')
                              : (val > 0 ? 'text-white/70' : 'text-white/10')
                          )}>
                            {val.toLocaleString()}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
