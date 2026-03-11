'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import clsx from 'clsx'

interface DataPoint {
  date: string
  contacts: number
  conversations: number
  activeVolunteers: number
}

const PERIODS = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
]

const GRANULARITIES = [
  { label: 'Daily', value: 'day' },
  { label: 'Weekly', value: 'week' },
]

export default function PtgTimeSeries({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')
  const [granularity, setGranularity] = useState('day')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/ptg/metrics/timeseries?period=${period}&granularity=${granularity}`,
      )
      if (res.ok) {
        const d = await res.json()
        setData(d.dates || [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [period, granularity])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData, refreshKey])

  const formatTick = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatLabel = (label: unknown) => {
    const d = new Date(String(label) + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-white/70">
          Activity over time
        </span>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={clsx(
                  'px-2.5 py-1 text-xs font-bold transition-colors',
                  period === p.value
                    ? 'bg-vc-purple/20 text-vc-purple-light'
                    : 'text-white/40 hover:text-white/60',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
            {GRANULARITIES.map(g => (
              <button
                key={g.value}
                onClick={() => setGranularity(g.value)}
                className={clsx(
                  'px-2.5 py-1 text-xs font-bold transition-colors',
                  granularity === g.value
                    ? 'bg-vc-purple/20 text-vc-purple-light'
                    : 'text-white/40 hover:text-white/60',
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-[260px] flex items-end gap-1 px-6 pb-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-white/[0.05] rounded-t animate-pulse"
              style={{ height: `${20 + Math.sin(i * 0.5) * 30 + Math.random() * 30}%` }}
            />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-[260px] text-white/40 text-xs">
          No activity data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorContacts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatTick}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15,15,25,0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.8)',
              }}
              labelFormatter={formatLabel}
            />
            <Area
              type="monotone"
              dataKey="conversations"
              name="Conversations"
              stroke="#a78bfa"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorConversations)"
            />
            <Area
              type="monotone"
              dataKey="contacts"
              name="Contacts"
              stroke="#2dd4bf"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorContacts)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#a78bfa]" />
          <span className="text-xs text-white/60">Conversations</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#2dd4bf]" />
          <span className="text-xs text-white/60">Contacts</span>
        </div>
      </div>
    </div>
  )
}
