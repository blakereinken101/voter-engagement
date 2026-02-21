'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { UserPlus, LogIn, Plus, Trash2, CheckCircle, XCircle, Phone, FileText, Circle, type LucideIcon } from 'lucide-react'
import clsx from 'clsx'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardStats {
  totalVolunteers: number
  totalContacts: number
  matchRate: number
  contactRate: number
  outcomeDistribution: Record<string, number>
  segmentDistribution: Record<string, number>
  dailyActivity: Array<{
    date: string
    contacts_added: number
    contacts_reached: number
    supporters_gained: number
  }>
  volunteerProgress: Array<{
    id: string
    name: string
    contacts: number
    matched: number
    contacted: number
    supporters: number
    lastActive: string | null
    contactRate: number
    conversionRate: number
  }>
  outreachMethods: Record<string, number>
  categoryBreakdown: Array<{
    category: string
    total: number
    contacted: number
    supporters: number
  }>
  recentActivity: Array<{
    id: number
    userName: string
    action: string
    details: string | null
    createdAt: string
  }>
  goals: {
    totalContactsGoal: number
    totalContactedGoal: number
    totalSupportersGoal: number
    currentContacts: number
    currentContacted: number
    currentSupporters: number
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const now = new Date()
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z')
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return `${Math.floor(diff / 604800)}w ago`
}

function pct(value: number, total: number): number {
  if (total === 0) return 0
  return Math.min(Math.round((value / total) * 100), 100)
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
}

function formatAction(action: string, details: string | null): string {
  let d: Record<string, string> = {}
  try { d = details ? JSON.parse(details) : {} } catch { /* noop */ }
  switch (action) {
    case 'sign_up': return 'created an account'
    case 'sign_in': return 'signed in'
    case 'add_contact': return `added contact ${d.name || ''}`.trim()
    case 'remove_contact': return 'removed a contact'
    case 'confirm_match': return 'confirmed a match'
    case 'reject_match': return 'rejected a match'
    case 'mark_contacted': return `contacted someone via ${d.method || 'unknown'}`
    case 'record_outcome': return `recorded outcome: ${d.outcome || 'unknown'}`
    default: return action.replace(/_/g, ' ')
  }
}

const ACTION_ICONS: Record<string, { Icon: LucideIcon; color: string }> = {
  sign_up: { Icon: UserPlus, color: 'text-vc-teal' },
  sign_in: { Icon: LogIn, color: 'text-vc-purple' },
  add_contact: { Icon: Plus, color: 'text-vc-teal' },
  remove_contact: { Icon: Trash2, color: 'text-vc-coral' },
  confirm_match: { Icon: CheckCircle, color: 'text-vc-teal' },
  reject_match: { Icon: XCircle, color: 'text-vc-coral' },
  mark_contacted: { Icon: Phone, color: 'text-vc-gold' },
  record_outcome: { Icon: FileText, color: 'text-vc-purple' },
}
const DEFAULT_ACTION_ICON = { Icon: Circle, color: 'text-vc-gray' }

const OUTCOME_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  supporter:       { bg: 'bg-vc-teal/10', text: 'text-vc-teal',       bar: 'bg-vc-teal' },
  undecided:       { bg: 'bg-vc-gold/10', text: 'text-vc-gold',     bar: 'bg-vc-gold' },
  opposed:         { bg: 'bg-vc-coral/10', text: 'text-vc-coral',           bar: 'bg-vc-coral' },
  'left-message':  { bg: 'bg-vc-purple/5', text: 'text-vc-purple',         bar: 'bg-vc-purple/60' },
  'no-answer':     { bg: 'bg-gray-100', text: 'text-vc-gray',       bar: 'bg-vc-gray/50' },
}

const OUTCOME_LABELS: Record<string, string> = {
  supporter: 'Supporter',
  undecided: 'Undecided',
  opposed: 'Opposed',
  'left-message': 'Left Message',
  'no-answer': 'No Answer',
}

const METHOD_LABELS: Record<string, string> = {
  text: 'Text',
  call: 'Call',
  '1:1': '1:1',
  email: 'Email',
  social: 'Social',
  other: 'Other',
}

const REFRESH_INTERVAL = 30_000

// ---------------------------------------------------------------------------
// Skeleton Components
// ---------------------------------------------------------------------------

function SkeletonBar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={clsx('animate-pulse rounded bg-gray-200', className)} style={style} />
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Goal progress skeleton */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <SkeletonBar className="h-4 w-32 mb-5" />
        <div className="space-y-5">
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div className="flex justify-between mb-1.5">
                <SkeletonBar className="h-3 w-20" />
                <SkeletonBar className="h-3 w-16" />
              </div>
              <SkeletonBar className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Metrics skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <SkeletonBar className="h-3 w-16 mb-3" />
            <SkeletonBar className="h-8 w-20" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <SkeletonBar className="h-4 w-36 mb-4" />
        <div className="flex items-end gap-2 h-40">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end gap-0.5">
              <SkeletonBar className="w-full" style={{ height: `${20 + Math.random() * 80}%` } as React.CSSProperties} />
            </div>
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <SkeletonBar className="h-4 w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <SkeletonBar key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section Components
// ---------------------------------------------------------------------------

function GoalProgress({ goals }: { goals: DashboardStats['goals'] }) {
  const rows = [
    {
      label: 'Contacts Added',
      current: goals.currentContacts,
      goal: goals.totalContactsGoal,
      color: 'bg-vc-purple',
      trackColor: 'bg-vc-purple/10',
    },
    {
      label: 'Contacted',
      current: goals.currentContacted,
      goal: goals.totalContactedGoal,
      color: 'bg-vc-gold',
      trackColor: 'bg-vc-gold/10',
    },
    {
      label: 'Supporters Won',
      current: goals.currentSupporters,
      goal: goals.totalSupportersGoal,
      color: 'bg-vc-teal',
      trackColor: 'bg-vc-teal/10',
    },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h2 className="font-display font-bold text-sm uppercase tracking-wider text-vc-gray mb-5">
        Goal Progress
      </h2>
      <div className="space-y-5">
        {rows.map(row => {
          const percent = pct(row.current, row.goal)
          return (
            <div key={row.label}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm font-medium text-vc-slate">{row.label}</span>
                <span className="text-xs font-display tabular-nums text-vc-gray">
                  {fmtNum(row.current)}/{fmtNum(row.goal)}{' '}
                  <span className="font-bold text-vc-purple">({percent}%)</span>
                </span>
              </div>
              <div className={clsx('h-3 rounded-full overflow-hidden', row.trackColor)}>
                <div
                  className={clsx('h-full rounded-full transition-all duration-700 ease-out', row.color)}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MetricsRow({ stats }: { stats: DashboardStats }) {
  const cards = [
    {
      label: 'Volunteers',
      value: fmtNum(stats.totalVolunteers),
      color: 'text-vc-purple',
      bg: 'bg-vc-purple/5',
      border: 'border-vc-purple/10',
    },
    {
      label: 'Total Contacts',
      value: fmtNum(stats.totalContacts),
      color: 'text-vc-purple',
      bg: 'bg-vc-purple/5',
      border: 'border-vc-purple/10',
    },
    {
      label: 'Match Rate',
      value: `${Math.round(stats.matchRate * 100)}%`,
      color: 'text-vc-teal',
      bg: 'bg-vc-teal/5',
      border: 'border-vc-teal/10',
    },
    {
      label: 'Contact Rate',
      value: `${Math.round(stats.contactRate * 100)}%`,
      color: 'text-vc-gold',
      bg: 'bg-vc-gold/10',
      border: 'border-vc-gold/20',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(card => (
        <div
          key={card.label}
          className={clsx(
            'rounded-xl p-5 border shadow-sm transition-all duration-300',
            card.bg,
            card.border,
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-vc-gray mb-1">
            {card.label}
          </p>
          <p className={clsx('font-display font-bold text-3xl', card.color)}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  )
}

function ActivityChart({ dailyActivity }: { dailyActivity: DashboardStats['dailyActivity'] }) {
  const last14 = useMemo(() => {
    const sorted = [...dailyActivity].sort((a, b) => a.date.localeCompare(b.date))
    return sorted.slice(-14)
  }, [dailyActivity])

  const maxValue = useMemo(() => {
    let max = 1
    for (const day of last14) {
      const total = day.contacts_added + day.contacts_reached + day.supporters_gained
      if (total > max) max = total
    }
    return max
  }, [last14])

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-sm uppercase tracking-wider text-vc-gray">
          Daily Activity (14 days)
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-vc-purple" />
            <span className="text-[10px] text-vc-gray">Added</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-vc-gold" />
            <span className="text-[10px] text-vc-gray">Reached</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-vc-teal" />
            <span className="text-[10px] text-vc-gray">Supporters</span>
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex items-end gap-1.5 sm:gap-2 h-44">
        {last14.map(day => {
          const addedH = (day.contacts_added / maxValue) * 100
          const reachedH = (day.contacts_reached / maxValue) * 100
          const supportersH = (day.supporters_gained / maxValue) * 100
          const total = day.contacts_added + day.contacts_reached + day.supporters_gained

          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center justify-end h-full group relative"
            >
              {/* Tooltip */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-vc-purple text-white text-[10px] px-2 py-1 rounded-md font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {total} total
              </div>

              {/* Stacked bars */}
              <div className="w-full flex flex-col justify-end gap-px h-full">
                {day.supporters_gained > 0 && (
                  <div
                    className="w-full bg-vc-teal rounded-t-sm transition-all duration-500"
                    style={{ height: `${supportersH}%`, minHeight: day.supporters_gained > 0 ? '2px' : '0' }}
                  />
                )}
                {day.contacts_reached > 0 && (
                  <div
                    className="w-full bg-vc-gold transition-all duration-500"
                    style={{ height: `${reachedH}%`, minHeight: day.contacts_reached > 0 ? '2px' : '0' }}
                  />
                )}
                {day.contacts_added > 0 && (
                  <div
                    className={clsx(
                      'w-full bg-vc-purple transition-all duration-500',
                      day.contacts_reached === 0 && day.supporters_gained === 0 ? 'rounded-t-sm' : '',
                    )}
                    style={{ height: `${addedH}%`, minHeight: day.contacts_added > 0 ? '2px' : '0' }}
                  />
                )}
                {total === 0 && (
                  <div className="w-full bg-gray-100 rounded-t-sm" style={{ height: '2px' }} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Day labels */}
      <div className="flex gap-1.5 sm:gap-2 mt-2">
        {last14.map(day => (
          <div key={day.date} className="flex-1 text-center">
            <span className="text-[9px] sm:text-[10px] text-vc-gray font-medium">
              {shortDay(day.date)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VolunteerTable({ volunteers }: { volunteers: DashboardStats['volunteerProgress'] }) {
  const sorted = useMemo(
    () => [...volunteers].sort((a, b) => b.supporters - a.supporters),
    [volunteers],
  )

  function conversionColor(rate: number): string {
    if (rate >= 50) return 'text-vc-teal font-bold'
    if (rate >= 25) return 'text-vc-gold font-bold'
    if (rate > 0) return 'text-vc-coral'
    return 'text-vc-gray'
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 pb-0">
        <h2 className="font-display font-bold text-sm uppercase tracking-wider text-vc-gray mb-4">
          Volunteer Progress
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-vc-gray">
                Name
              </th>
              <th className="text-right px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-vc-gray">
                Contacts
              </th>
              <th className="text-right px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-vc-gray">
                Contacted
              </th>
              <th className="text-right px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-vc-gray">
                Supporters
              </th>
              <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-vc-gray min-w-[120px]">
                Contact Rate
              </th>
              <th className="text-right px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-vc-gray">
                Conv. Rate
              </th>
              <th className="text-right px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-vc-gray">
                Last Active
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map(v => {
              const contactPct = v.contactRate
              const convPct = v.conversionRate
              return (
                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3 font-medium text-vc-purple whitespace-nowrap">
                    {v.name}
                  </td>
                  <td className="px-3 py-3 text-right font-display text-vc-slate tabular-nums">
                    {v.contacts}
                  </td>
                  <td className="px-3 py-3 text-right font-display text-vc-slate tabular-nums">
                    {v.contacted}
                  </td>
                  <td className="px-3 py-3 text-right font-display text-vc-purple font-bold tabular-nums">
                    {v.supporters}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-vc-purple/70 transition-all duration-500"
                          style={{ width: `${contactPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-display text-vc-gray w-8 text-right tabular-nums">
                        {contactPct}%
                      </span>
                    </div>
                  </td>
                  <td className={clsx('px-3 py-3 text-right font-display tabular-nums', conversionColor(v.conversionRate))}>
                    {convPct}%
                  </td>
                  <td className="px-6 py-3 text-right text-[11px] text-vc-gray whitespace-nowrap">
                    {v.lastActive ? timeAgo(v.lastActive) : 'Never'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="text-center py-8 text-vc-gray text-sm">
            No volunteer data yet
          </div>
        )}
      </div>
    </div>
  )
}

function OutreachMethods({ methods }: { methods: Record<string, number> }) {
  const entries = useMemo(() => {
    return Object.entries(methods)
      .map(([key, value]) => ({ key, label: METHOD_LABELS[key] || key, value }))
      .sort((a, b) => b.value - a.value)
  }, [methods])

  const maxVal = useMemo(() => Math.max(...entries.map(e => e.value), 1), [entries])

  if (entries.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h2 className="font-display font-bold text-sm uppercase tracking-wider text-vc-gray mb-4">
        Outreach Methods
      </h2>
      <div className="space-y-3">
        {entries.map(entry => (
          <div key={entry.key}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm font-medium text-vc-slate">{entry.label}</span>
              <span className="text-xs font-display text-vc-gray tabular-nums">{fmtNum(entry.value)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-vc-purple transition-all duration-500"
                style={{ width: `${pct(entry.value, maxVal)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OutcomeDistribution({ distribution }: { distribution: Record<string, number> }) {
  const entries = useMemo(() => {
    const ordered = ['supporter', 'undecided', 'opposed', 'left-message', 'no-answer']
    return ordered
      .filter(key => distribution[key] !== undefined)
      .map(key => ({
        key,
        label: OUTCOME_LABELS[key] || key,
        value: distribution[key] || 0,
        colors: OUTCOME_COLORS[key] || OUTCOME_COLORS['no-answer'],
      }))
  }, [distribution])

  const total = useMemo(() => entries.reduce((sum, e) => sum + e.value, 0), [entries])

  if (total === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h2 className="font-display font-bold text-sm uppercase tracking-wider text-vc-gray mb-4">
        Outcome Distribution
      </h2>

      {/* Stacked horizontal bar */}
      <div className="h-6 rounded-full overflow-hidden flex bg-gray-100 mb-4">
        {entries.map(entry => {
          const widthPct = (entry.value / total) * 100
          if (widthPct === 0) return null
          return (
            <div
              key={entry.key}
              className={clsx('h-full transition-all duration-700', entry.colors.bar)}
              style={{ width: `${widthPct}%` }}
              title={`${entry.label}: ${entry.value}`}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {entries.map(entry => (
          <div key={entry.key} className="flex items-center gap-2">
            <div className={clsx('w-2.5 h-2.5 rounded-full', entry.colors.bar)} />
            <span className="text-xs text-vc-gray">
              {entry.label}
            </span>
            <span className="text-xs font-display font-bold text-vc-slate tabular-nums">
              {entry.value}
            </span>
            <span className="text-[10px] text-vc-gray">
              ({pct(entry.value, total)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentActivityFeed({ activities }: { activities: DashboardStats['recentActivity'] }) {
  const last10 = useMemo(() => activities.slice(0, 10), [activities])

  if (last10.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h2 className="font-display font-bold text-sm uppercase tracking-wider text-vc-gray mb-4">
        Recent Activity
      </h2>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-100" />

        <div className="space-y-0.5">
          {last10.map((activity, idx) => {
            const { Icon: ActionIcon, color: iconColor } = ACTION_ICONS[activity.action] || DEFAULT_ACTION_ICON
            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 py-2 pl-0 relative"
              >
                <div className={clsx('w-[30px] h-[30px] rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0 z-10 border border-gray-100', iconColor)}>
                  <ActionIcon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm leading-snug">
                    <span className="font-medium text-vc-purple">{activity.userName}</span>{' '}
                    <span className="text-vc-gray">{formatAction(activity.action, activity.details)}</span>
                  </p>
                </div>
                <span className="text-[10px] text-vc-gray/60 font-mono whitespace-nowrap flex-shrink-0 pt-1">
                  {timeAgo(activity.createdAt)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AdminSummary() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)

  const fetchStats = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true)
      setError(null)
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: DashboardStats = await res.json()
      setStats(data)
      setLastFetched(new Date())
      setSecondsAgo(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
      if (isInitial) setStats(null)
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchStats(true)
  }, [fetchStats])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchStats(false), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchStats])

  // Update "seconds ago" counter every second
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastFetched) {
        setSecondsAgo(Math.floor((Date.now() - lastFetched.getTime()) / 1000))
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [lastFetched])

  // --- Loading state ---
  if (loading) return <LoadingSkeleton />

  // --- Error state ---
  if (error && !stats) {
    return (
      <div className="bg-vc-coral/5 border border-vc-coral/20 rounded-xl p-8 text-center animate-fade-in">
        <div className="text-3xl mb-3">!</div>
        <p className="font-display font-bold text-vc-coral text-lg mb-1">
          Failed to load dashboard
        </p>
        <p className="text-sm text-vc-gray mb-4">{error}</p>
        <button
          onClick={() => fetchStats(true)}
          className="bg-vc-coral text-white font-bold text-sm px-5 py-2 rounded-lg hover:bg-vc-coral-light transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with last-updated indicator */}
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-xl text-vc-purple">
          Dashboard
        </h1>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-[10px] font-medium text-vc-coral bg-vc-coral/5 px-2 py-0.5 rounded">
              Update failed
            </span>
          )}
          <span className="text-[11px] text-vc-gray font-mono">
            Updated {secondsAgo < 5 ? 'just now' : `${secondsAgo}s ago`}
          </span>
          <div
            className={clsx(
              'w-1.5 h-1.5 rounded-full',
              secondsAgo < 35 ? 'bg-vc-teal' : 'bg-vc-gold',
            )}
          />
        </div>
      </div>

      {/* 1. Goal Progress */}
      <GoalProgress goals={stats.goals} />

      {/* 2. Key Metrics */}
      <MetricsRow stats={stats} />

      {/* 3. Activity Chart */}
      {stats.dailyActivity.length > 0 && (
        <ActivityChart dailyActivity={stats.dailyActivity} />
      )}

      {/* 4. Volunteer Progress Table */}
      <VolunteerTable volunteers={stats.volunteerProgress} />

      {/* Bottom two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* 5. Outreach Methods */}
          <OutreachMethods methods={stats.outreachMethods} />

          {/* 6. Outcome Distribution */}
          <OutcomeDistribution distribution={stats.outcomeDistribution} />
        </div>

        {/* Right column */}
        <div>
          {/* 7. Recent Activity Feed */}
          <RecentActivityFeed activities={stats.recentActivity} />
        </div>
      </div>
    </div>
  )
}
