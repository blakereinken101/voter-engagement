'use client'

import { useState, useEffect } from 'react'
import { Trophy } from 'lucide-react'
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

const RANK_STYLES: Record<number, { bg: string; text: string }> = {
  0: { bg: 'bg-vc-gold/10', text: 'text-vc-gold' },
  1: { bg: 'bg-white/10', text: 'text-white/50' },
  2: { bg: 'bg-vc-coral/10', text: 'text-vc-coral' },
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/leaderboard')
      .then(res => res.json())
      .then(data => setEntries(data.leaderboard || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-12 text-white/50">Loading leaderboard...</div>

  if (entries.length === 0) {
    return <div className="text-center py-12 text-white/50">No volunteer activity yet</div>
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {['Rank', 'Volunteer', 'Contacts', 'Contacted', 'Supporters', 'Contact Rate', 'Conversion'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const rankStyle = RANK_STYLES[i]
              return (
                <tr key={entry.id} className={clsx('border-b border-white/5 hover:bg-white/5 transition-colors', i < 3 ? 'bg-vc-gold/5' : i % 2 === 0 ? '' : 'bg-white/[0.02]')}>
                  <td className="px-4 py-3">
                    {i < 3 ? (
                      <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center', rankStyle?.bg)}>
                        <Trophy className={clsx('w-4 h-4', rankStyle?.text)} />
                      </div>
                    ) : (
                      <span className="font-display font-bold text-lg text-white/20">
                        #{i + 1}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-white">{entry.name}</td>
                  <td className="px-4 py-3 font-display tabular-nums text-white">{entry.contacts}</td>
                  <td className="px-4 py-3 font-display tabular-nums text-vc-gold">{entry.contacted}</td>
                  <td className="px-4 py-3 font-display tabular-nums text-vc-teal font-bold">{entry.supporters}</td>
                  <td className="px-4 py-3 font-display tabular-nums text-white">{entry.contact_rate}%</td>
                  <td className="px-4 py-3 font-display tabular-nums font-bold text-vc-teal">{entry.conversion_rate}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
