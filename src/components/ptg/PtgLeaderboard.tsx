'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trophy, Loader2, MessageSquare, BookOpen, UserPlus, ThumbsUp } from 'lucide-react'
import clsx from 'clsx'

interface LeaderboardEntry {
  rank: number
  volunteerId: string
  volunteerName: string
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
  leaderboard: LeaderboardEntry[]
}

export default function PtgLeaderboard({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'weekly' | 'daily'>('weekly')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ptg/leaderboard?period=${period}`)
      if (res.ok) {
        setData(await res.json())
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData, refreshKey])

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-amber-400/15 text-amber-300 border-amber-400/20'
    if (rank === 2) return 'bg-gray-300/10 text-gray-300 border-gray-300/15'
    if (rank === 3) return 'bg-orange-400/10 text-orange-300 border-orange-400/15'
    return 'bg-white/[0.03] text-white/30 border-white/[0.06]'
  }

  const getRankIcon = (rank: number) => {
    if (rank <= 3) return <Trophy className={clsx('w-3 h-3', rank === 1 && 'text-amber-300', rank === 2 && 'text-gray-300', rank === 3 && 'text-orange-300')} />
    return <span className="text-[10px] tabular-nums">{rank}</span>
  }

  return (
    <div className="space-y-4">
      {/* Header + Period Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Leaderboard</h3>
            {data && (
              <p className="text-[10px] text-white/30">
                {data.periodLabel} &middot; {data.timezone.replace('America/', '').replace('_', ' ')}
              </p>
            )}
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
          <button
            onClick={() => setPeriod('weekly')}
            className={clsx(
              'px-3 py-1.5 text-[10px] font-bold transition-colors',
              period === 'weekly'
                ? 'bg-amber-400/15 text-amber-300'
                : 'text-white/30 hover:text-white/50',
            )}
          >
            Weekly
          </button>
          <button
            onClick={() => setPeriod('daily')}
            className={clsx(
              'px-3 py-1.5 text-[10px] font-bold transition-colors',
              period === 'daily'
                ? 'bg-amber-400/15 text-amber-300'
                : 'text-white/30 hover:text-white/50',
            )}
          >
            Daily
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-amber-400/50 animate-spin" />
        </div>
      ) : !data || data.leaderboard.length === 0 ? (
        <div className="text-center py-12 text-white/20 text-sm">
          No activity recorded for this {period === 'weekly' ? 'week' : 'day'} yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Column headers */}
          <div className="grid grid-cols-[40px_1fr_80px_80px_70px_70px] gap-2 px-3 py-1.5 text-[9px] font-bold text-white/25 uppercase tracking-widest">
            <span>#</span>
            <span>Volunteer</span>
            <span className="text-right flex items-center justify-end gap-1"><MessageSquare className="w-2.5 h-2.5" /> Convos</span>
            <span className="text-right flex items-center justify-end gap-1"><BookOpen className="w-2.5 h-2.5" /> Rolodex</span>
            <span className="text-right flex items-center justify-end gap-1"><ThumbsUp className="w-2.5 h-2.5" /> Support</span>
            <span className="text-right flex items-center justify-end gap-1"><UserPlus className="w-2.5 h-2.5" /> Vol Int</span>
          </div>

          {data.leaderboard.map((entry) => (
            <div
              key={entry.volunteerId}
              className={clsx(
                'grid grid-cols-[40px_1fr_80px_80px_70px_70px] gap-2 items-center px-3 py-2 rounded-lg border transition-colors',
                entry.rank <= 3
                  ? getRankStyle(entry.rank)
                  : 'border-white/[0.04] hover:bg-white/[0.02]',
              )}
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-full border border-current/20">
                {getRankIcon(entry.rank)}
              </div>
              <div className="min-w-0">
                <p className={clsx(
                  'text-xs font-bold truncate',
                  entry.rank <= 3 ? 'text-white' : 'text-white/70',
                )}>
                  {entry.volunteerName}
                </p>
                <p className="text-[9px] text-white/25 truncate">
                  {entry.organizerName} &middot; {entry.region}
                </p>
              </div>
              <p className={clsx(
                'text-right text-xs tabular-nums font-bold',
                entry.conversations > 0 ? 'text-vc-purple-light' : 'text-white/20',
              )}>
                {entry.conversations}
              </p>
              <p className={clsx(
                'text-right text-xs tabular-nums font-bold',
                entry.contactsRolodexed > 0 ? 'text-vc-teal' : 'text-white/20',
              )}>
                {entry.contactsRolodexed}
              </p>
              <p className={clsx(
                'text-right text-xs tabular-nums',
                entry.supporters > 0 ? 'text-emerald-400/70' : 'text-white/15',
              )}>
                {entry.supporters}
              </p>
              <p className={clsx(
                'text-right text-xs tabular-nums',
                entry.volInterest > 0 ? 'text-blue-400/70' : 'text-white/15',
              )}>
                {entry.volInterest}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
