'use client'

import { useState, useEffect } from 'react'
import { Trophy } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'

interface LeaderboardEntry {
  id: string
  name: string
  contacts: number
  contacted: number
  supporters: number
  contact_rate: number
  conversion_rate: number
}

const RANK_STYLES: Record<number, { bg: string; text: string; label: string }> = {
  0: { bg: 'bg-vc-gold/10', text: 'text-vc-gold', label: '1st' },
  1: { bg: 'bg-white/10', text: 'text-white/50', label: '2nd' },
  2: { bg: 'bg-vc-coral/10', text: 'text-vc-coral', label: '3rd' },
}

export default function VolunteerLeaderboard() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => setEntries(data.leaderboard || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading || entries.length < 2) return null

  const myRank = entries.findIndex(e => e.id === user?.id)

  return (
    <div className="glass-card p-5 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between hover:opacity-80 transition-opacity text-left"
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-vc-gold" />
          <span className="text-sm font-bold text-white/70">Team Leaderboard</span>
          {myRank >= 0 && (
            <span className="text-xs text-white/40 ml-2">
              You&apos;re #{myRank + 1}
            </span>
          )}
        </div>
        <span className="text-white/30 text-xs">
          {isExpanded ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-4 animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['', 'Volunteer', 'Contacts', 'Reached', 'Supporters'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 10).map((entry, i) => {
                  const rankStyle = RANK_STYLES[i]
                  const isMe = entry.id === user?.id
                  return (
                    <tr
                      key={entry.id}
                      className={clsx(
                        'border-b border-white/5 transition-colors',
                        isMe ? 'bg-vc-purple/10' : 'hover:bg-white/5',
                      )}
                    >
                      <td className="px-3 py-2.5 w-10">
                        {i < 3 ? (
                          <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center', rankStyle?.bg)}>
                            <Trophy className={clsx('w-3.5 h-3.5', rankStyle?.text)} />
                          </div>
                        ) : (
                          <span className="font-display font-bold text-sm text-white/20 pl-1.5">
                            {i + 1}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={clsx('font-medium', isMe ? 'text-vc-purple-light font-bold' : 'text-white')}>
                          {entry.name}
                          {isMe && <span className="text-[10px] text-vc-purple-light/60 ml-1.5">(you)</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-display tabular-nums text-white/70">{entry.contacts}</td>
                      <td className="px-3 py-2.5 font-display tabular-nums text-vc-gold">{entry.contacted}</td>
                      <td className="px-3 py-2.5 font-display tabular-nums text-vc-teal font-bold">{entry.supporters}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
