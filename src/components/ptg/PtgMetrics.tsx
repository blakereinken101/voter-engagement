'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, MessageSquare, BookOpen, UserCheck, UsersRound, Loader2 } from 'lucide-react'
import PtgTimeSeries from './PtgTimeSeries'

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
        <Loader2 className="w-4 h-4 text-vc-purple-light animate-spin" />
      </div>
    )
  }

  if (!data) return null

  const { summary } = data

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard
          icon={<UsersRound className="w-4 h-4" />}
          label="Total Volunteers"
          singleValue={summary.totalVolunteers}
          accent="purple"
        />
        <SummaryCard
          icon={<Users className="w-4 h-4" />}
          label="Relational Volunteers"
          sublabel={`${data.threshold}+ contacts`}
          daily={summary.relationalVolunteers.daily}
          weekly={summary.relationalVolunteers.weekly}
          total={summary.relationalVolunteers.total}
        />
        <SummaryCard
          icon={<UserCheck className="w-4 h-4" />}
          label="Active Rel. Volunteers"
          sublabel={`${data.threshold}+ in ${data.activeWindowDays}d`}
          weeklyOnly={summary.activeRelationalVolunteers.weekly}
        />
        <SummaryCard
          icon={<MessageSquare className="w-4 h-4" />}
          label="Relational Conversations"
          daily={summary.relationalConversations.daily}
          weekly={summary.relationalConversations.weekly}
          total={summary.relationalConversations.total}
        />
        <SummaryCard
          icon={<BookOpen className="w-4 h-4" />}
          label="Contacts Roladexed"
          daily={summary.contactsRoladexed.daily}
          weekly={summary.contactsRoladexed.weekly}
          total={summary.contactsRoladexed.total}
        />
      </div>

      {/* Time Series Chart */}
      <PtgTimeSeries refreshKey={refreshKey} />

      {/* Breakdown Tables: 3-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
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
            <div className="px-3 py-2 bg-white/[0.03] border-b border-white/[0.06]">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">By Volunteer</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#0f0f19]">
                  <tr className="text-white/30 text-[10px] uppercase tracking-wider">
                    <th className="text-left px-3 py-1.5 font-bold">Volunteer</th>
                    <th className="text-right px-2 py-1.5 font-bold">Daily</th>
                    <th className="text-right px-2 py-1.5 font-bold">Weekly</th>
                    <th className="text-right px-3 py-1.5 font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byVolunteer.slice(0, 50).map((v, i) => (
                    <tr key={v.id} className={i % 2 === 1 ? 'bg-white/[0.01]' : ''}>
                      <td className="px-3 py-1.5">
                        <p className="text-white/70 font-medium truncate max-w-[120px]">{v.name}</p>
                        <p className="text-[9px] text-white/25 truncate">{v.organizerName}</p>
                      </td>
                      <td className="text-right px-2 py-1.5 text-white/40 tabular-nums">{v.dailyContacts}</td>
                      <td className="text-right px-2 py-1.5 text-white/50 tabular-nums">{v.weeklyContacts}</td>
                      <td className="text-right px-3 py-1.5 text-white/70 tabular-nums font-medium">{v.totalContacts}</td>
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
      <div className="px-3 py-2 bg-white/[0.03] border-b border-white/[0.06]">
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{title}</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-white/30 text-[10px] uppercase tracking-wider">
            <th className="text-left px-3 py-1.5 font-bold">{title.replace('By ', '')}</th>
            <th className="text-right px-2 py-1.5 font-bold">Vols</th>
            <th className="text-right px-2 py-1.5 font-bold">Active</th>
            <th className="text-right px-2 py-1.5 font-bold">Daily</th>
            <th className="text-right px-2 py-1.5 font-bold">Weekly</th>
            <th className="text-right px-3 py-1.5 font-bold">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className={i % 2 === 1 ? 'bg-white/[0.01]' : ''}>
              <td className="px-3 py-1.5 text-white/70 font-medium truncate max-w-[120px]">{r.label}</td>
              <td className="text-right px-2 py-1.5 text-white/50 tabular-nums">{r.vols}</td>
              <td className="text-right px-2 py-1.5 text-emerald-400/70 tabular-nums font-medium">{r.active}</td>
              <td className="text-right px-2 py-1.5 text-white/40 tabular-nums">{r.daily}</td>
              <td className="text-right px-2 py-1.5 text-white/50 tabular-nums">{r.weekly}</td>
              <td className="text-right px-3 py-1.5 text-white/70 tabular-nums font-medium">{r.total}</td>
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
  sublabel?: string
  daily?: number
  weekly?: number
  total?: number
  weeklyOnly?: number
  singleValue?: number
  accent?: 'purple' | 'emerald'
}) {
  if (singleValue !== undefined) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className={accent === 'emerald' ? 'text-emerald-400' : 'text-vc-purple-light'}>{icon}</span>
          <div>
            <p className="text-[11px] font-bold text-white/60 leading-tight">{label}</p>
            {sublabel && <p className="text-[9px] text-white/25">{sublabel}</p>}
          </div>
        </div>
        <p className="text-2xl font-bold text-white tabular-nums">{singleValue}</p>
      </div>
    )
  }

  if (weeklyOnly !== undefined) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-emerald-400">{icon}</span>
          <div>
            <p className="text-[11px] font-bold text-white/60 leading-tight">{label}</p>
            {sublabel && <p className="text-[9px] text-white/25">{sublabel}</p>}
          </div>
        </div>
        <p className="text-2xl font-bold text-emerald-400 tabular-nums">{weeklyOnly}</p>
        <p className="text-[9px] text-white/25 mt-0.5">this week</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-vc-purple-light">{icon}</span>
        <div>
          <p className="text-[11px] font-bold text-white/60 leading-tight">{label}</p>
          {sublabel && <p className="text-[9px] text-white/25">{sublabel}</p>}
        </div>
      </div>
      <div className="flex items-baseline gap-3">
        <div>
          <p className="text-2xl font-bold text-white tabular-nums">{total ?? 0}</p>
          <p className="text-[9px] text-white/25">total</p>
        </div>
        <div className="border-l border-white/[0.06] pl-3">
          <p className="text-sm font-bold text-white/60 tabular-nums">{weekly ?? 0}</p>
          <p className="text-[9px] text-white/25">weekly</p>
        </div>
        <div>
          <p className="text-sm font-bold text-white/40 tabular-nums">{daily ?? 0}</p>
          <p className="text-[9px] text-white/25">daily</p>
        </div>
      </div>
    </div>
  )
}
