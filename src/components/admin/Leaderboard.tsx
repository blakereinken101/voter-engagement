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
  1: { bg: 'bg-gray-100', text: 'text-vc-gray' },
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

  if (loading) return <div className="text-center py-12 text-vc-gray">Loading leaderboard...</div>

  if (entries.length === 0) {
    return <div className="text-center py-12 text-vc-gray">No volunteer activity yet</div>
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-vc-purple/[0.03] border-b border-gray-100">
              {['Rank', 'Volunteer', 'Contacts', 'Contacted', 'Supporters', 'Contact Rate', 'Conversion'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-vc-gray">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const rankStyle = RANK_STYLES[i]
              return (
                <tr key={entry.id} className={clsx(i < 3 ? 'bg-vc-gold/5' : i % 2 === 0 ? '' : 'bg-vc-purple/[0.01]')}>
                  <td className="px-4 py-3">
                    {i < 3 ? (
                      <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center', rankStyle?.bg)}>
                        <Trophy className={clsx('w-4 h-4', rankStyle?.text)} />
                      </div>
                    ) : (
                      <span className="font-display font-bold text-lg text-vc-purple/30">
                        #{i + 1}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-vc-slate">{entry.name}</td>
                  <td className="px-4 py-3 font-display tabular-nums">{entry.contacts}</td>
                  <td className="px-4 py-3 font-display tabular-nums text-vc-gold">{entry.contacted}</td>
                  <td className="px-4 py-3 font-display tabular-nums text-vc-teal font-bold">{entry.supporters}</td>
                  <td className="px-4 py-3 font-display tabular-nums">{entry.contact_rate}%</td>
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
