'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, MessageSquare, BookOpen, UserCheck, UsersRound, Loader2 } from 'lucide-react'
import MetricTooltip from './MetricTooltip'
import clsx from 'clsx'

interface MetricsData {
  threshold: number
  activeWindowDays: number
  summary: {
    totalVolunteers: number
    relationalVolunteers: { weekly: number; daily: number; total: number }
    activeRelationalVolunteers: { weekly: number }
    relationalConversations: { daily: number; weekly: number; total: number }
    contactsRoladexed: { daily: number; weekly: number; total: number }
  }
  byRegion: {
    region: string
    relationalVolunteers: number
    activeRelationalVolunteers: number
    conversations: { daily: number; weekly: number; overall: number }
    contacts: { daily: number; weekly: number; overall: number }
  }[]
  byOrganizer: {
    name: string
    relationalVolunteers: number
    activeRelationalVolunteers: number
    conversations: { daily: number; weekly: number; overall: number }
    contacts: { daily: number; weekly: number; overall: number }
  }[]
  byVolunteer: {
    id: string
    name: string
    region: string
    organizerName: string
    totalContacts: number
    weeklyContacts: number
    dailyContacts: number
    isRelational: boolean
    isActive: boolean
  }[]
}

export default function PtgMetrics({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ptg/metrics')
      if (res.ok) {
        setData(await res.json())
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMetrics() }, [fetchMetrics, refreshKey])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 text-vc-blue-light animate-spin" />
      </div>
    )
  }

  if (!data) return null

  const { summary } = data

  return (
    <div className="space-y-3">
      {/* Intro */}
      <p className="text-sm text-white/50 leading-relaxed">
        Here&apos;s how your relational program is performing. Hover the <span className="text-white/70">(?)</span> icons for definitions.
      </p>

      {/* Summary Cards — funnel order */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <SummaryCard
          icon={<UsersRound className="w-4 h-4" />}
          label="Total Volunteers"
          tooltip="Everyone who has submitted at least one contact through the relational program."
          singleValue={summary.totalVolunteers}
          accent="blue"
        />
        <SummaryCard
          icon={<Users className="w-4 h-4" />}
          label="Relational Volunteers"
          tooltip="Volunteers who have logged enough contacts to meet the relational threshold."
          sublabel={`${data.threshold}+ contacts`}
          daily={summary.relationalVolunteers.daily}
          weekly={summary.relationalVolunteers.weekly}
          total={summary.relationalVolunteers.total}
        />
        <SummaryCard
          icon={<UserCheck className="w-4 h-4" />}
          label="Active Rel. Volunteers"
          tooltip="Relational volunteers with recent activity within the active window."
          sublabel={`${data.threshold}+ in ${data.activeWindowDays}d`}
          weeklyOnly={summary.activeRelationalVolunteers.weekly}
        />
        <SummaryCard
          icon={<MessageSquare className="w-4 h-4" />}
          label="Relational Conversations"
          tooltip="Total face-to-face conversations logged by relational volunteers."
          daily={summary.relationalConversations.daily}
          weekly={summary.relationalConversations.weekly}
          total={summary.relationalConversations.total}
        />
        <SummaryCard
          icon={<BookOpen className="w-4 h-4" />}
          label="Contacts Rolodexed"
          tooltip="Unique contacts added to the relational rolodex by volunteers."
          daily={summary.contactsRoladexed.daily}
          weekly={summary.contactsRoladexed.weekly}
          total={summary.contactsRoladexed.total}
        />
      </div>

      {/* Breakdown Tables: 3-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* By Region */}
        {data.byRegion.length > 0 && (
          <BreakdownTable
            title="By Region"
            rows={data.byRegion.map(r => ({
              label: r.region,
              vols: r.relationalVolunteers,
              active: r.activeRelationalVolunteers,
              daily: r.contacts.daily,
              weekly: r.contacts.weekly,
              total: r.contacts.overall,
            }))}
          />
        )}

        {/* By Organizer */}
        {data.byOrganizer.length > 0 && (
          <BreakdownTable
            title="By Organizer"
            rows={data.byOrganizer.map(r => ({
              label: r.name,
              vols: r.relationalVolunteers,
              active: r.activeRelationalVolunteers,
              daily: r.contacts.daily,
              weekly: r.contacts.weekly,
              total: r.contacts.overall,
            }))}
          />
        )}

        {/* By Volunteer */}
        {data.byVolunteer && data.byVolunteer.length > 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] overflow-hidden">
            <div className="px-3 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
              <span className="text-xs font-bold text-white/60 uppercase tracking-widest">By Volunteer</span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#0f0f19] border-b-2 border-white/[0.08]">
                  <tr className="text-white/60 text-xs uppercase tracking-widest">
                    <th className="text-left px-3 py-2.5 font-bold">Volunteer</th>
                    <th className="text-right px-2 py-2.5 font-bold">Today</th>
                    <th className="text-right px-2 py-2.5 font-bold">Weekly</th>
                    <th className="text-right px-3 py-2.5 font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byVolunteer.slice(0, 50).map((v, i) => (
                    <tr key={v.id} className={clsx(
                      'border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]',
                      i % 2 === 0 ? 'bg-white/[0.015]' : 'bg-transparent'
                    )}>
                      <td className="px-3 py-2">
                        <p className="text-white/90 font-medium truncate max-w-[140px]">{v.name}</p>
                        <p className="text-[11px] text-white/50 truncate">{v.region || v.organizerName}</p>
                      </td>
                      <td className="text-right px-2 py-2 text-white/60 tabular-nums">{v.dailyContacts}</td>
                      <td className="text-right px-2 py-2 text-white/80 tabular-nums">{v.weeklyContacts}</td>
                      <td className="text-right px-3 py-2 text-white/90 tabular-nums font-bold">{v.totalContacts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function BreakdownTable({ title, rows }: {
  title: string
  rows: { label: string; vols: number; active: number; daily: number; weekly: number; total: number }[]
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] overflow-hidden">
      <div className="px-3 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
        <span className="text-xs font-bold text-white/60 uppercase tracking-widest">{title}</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-white/50 text-xs uppercase tracking-widest bg-[#0f0f19]/80">
            <th className="text-left px-3 py-2 font-bold">{title.replace('By ', '')}</th>
            <th className="text-right px-2 py-2 font-bold">Vols</th>
            <th className="text-right px-2 py-2 font-bold">Active</th>
            <th className="text-right px-2 py-2 font-bold">Today</th>
            <th className="text-right px-2 py-2 font-bold">Weekly</th>
            <th className="text-right px-3 py-2 font-bold">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className={clsx(
              'border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]',
              i % 2 === 0 ? 'bg-white/[0.015]' : 'bg-transparent'
            )}>
              <td className="px-3 py-2 text-white/90 font-medium truncate max-w-[120px]">{r.label}</td>
              <td className="text-right px-2 py-2 text-white/70 tabular-nums">{r.vols}</td>
              <td className="text-right px-2 py-2 text-emerald-400/80 tabular-nums font-medium">{r.active}</td>
              <td className="text-right px-2 py-2 text-white/60 tabular-nums">{r.daily}</td>
              <td className="text-right px-2 py-2 text-white/80 tabular-nums">{r.weekly}</td>
              <td className="text-right px-3 py-2 text-white/90 tabular-nums font-bold">{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  tooltip,
  sublabel,
  daily,
  weekly,
  total,
  weeklyOnly,
  singleValue,
  accent,
}: {
  icon: React.ReactNode
  label: string
  tooltip?: string
  sublabel?: string
  daily?: number
  weekly?: number
  total?: number
  weeklyOnly?: number
  singleValue?: number
  accent?: 'blue' | 'emerald'
}) {
  const isHighlight = label === 'Relational Conversations' || label === 'Contacts Rolodexed'

  if (singleValue !== undefined) {
    return (
      <div className={clsx(
        'rounded-xl border p-4',
        isHighlight
          ? 'border-vc-blue/20 bg-white/[0.025] shadow-[0_0_20px_rgba(59,130,246,0.08)]'
          : 'border-white/[0.08] bg-white/[0.015]'
      )}>
        <div className="flex items-center gap-2 mb-2">
          <span className={accent === 'emerald' ? 'text-emerald-400' : 'text-vc-blue-light'}>{icon}</span>
          <div className="flex items-center">
            <p className="text-sm font-bold text-white/70 leading-tight">{label}</p>
            {tooltip && <MetricTooltip text={tooltip} />}
          </div>
        </div>
        {sublabel && <p className="text-xs text-white/50 -mt-1 mb-1">{sublabel}</p>}
        <p className="text-4xl lg:text-5xl font-bold font-display text-white tabular-nums">{singleValue}</p>
      </div>
    )
  }

  if (weeklyOnly !== undefined) {
    return (
      <div className={clsx(
        'rounded-xl border p-4',
        isHighlight
          ? 'border-vc-blue/20 bg-white/[0.025] shadow-[0_0_20px_rgba(59,130,246,0.08)]'
          : 'border-white/[0.08] bg-white/[0.015]'
      )}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-emerald-400">{icon}</span>
          <div className="flex items-center">
            <p className="text-sm font-bold text-white/70 leading-tight">{label}</p>
            {tooltip && <MetricTooltip text={tooltip} />}
          </div>
        </div>
        {sublabel && <p className="text-xs text-white/50 -mt-1 mb-1">{sublabel}</p>}
        <p className="text-4xl lg:text-5xl font-bold font-display text-emerald-400 tabular-nums">{weeklyOnly}</p>
        <p className="text-xs text-white/50 mt-0.5">this week</p>
      </div>
    )
  }

  return (
    <div className={clsx(
      'rounded-xl border p-4',
      isHighlight
        ? 'border-vc-blue/20 bg-white/[0.025] shadow-[0_0_20px_rgba(59,130,246,0.08)]'
        : 'border-white/[0.08] bg-white/[0.015]'
    )}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-vc-blue-light">{icon}</span>
        <div className="flex items-center">
          <p className="text-sm font-bold text-white/70 leading-tight">{label}</p>
          {tooltip && <MetricTooltip text={tooltip} />}
        </div>
      </div>
      {sublabel && <p className="text-xs text-white/50 -mt-1 mb-1">{sublabel}</p>}
      <div className="flex items-baseline gap-3">
        <div>
          <p className="text-4xl lg:text-5xl font-bold font-display text-white tabular-nums">{total ?? 0}</p>
          <p className="text-xs text-white/50">total</p>
        </div>
        <div className="border-l border-white/[0.06] pl-3">
          <p className="text-lg font-bold text-white/70 tabular-nums">{weekly ?? 0}</p>
          <p className="text-xs text-white/50">weekly</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white/60 tabular-nums">{daily ?? 0}</p>
          <p className="text-xs text-white/50">today</p>
        </div>
      </div>
    </div>
  )
}
