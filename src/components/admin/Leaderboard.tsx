'use client'

import { useState, useEffect } from 'react'

interface LeaderboardEntry {
  id: string
  name: string
  contacts: number
  contacted: number
  supporters: number
  contact_rate: number
  conversion_rate: number
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

  if (loading) return <div className="text-center py-12 text-rally-slate-light">Loading leaderboard...</div>

  if (entries.length === 0) {
    return <div className="text-center py-12 text-rally-slate-light">No volunteer activity yet</div>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-rally-navy/[0.03] border-b border-gray-100">
              {['Rank', 'Volunteer', 'Contacts', 'Contacted', 'Supporters', 'Contact Rate', 'Conversion'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-rally-slate-light">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={entry.id} className={`${i < 3 ? 'bg-rally-yellow/5' : i % 2 === 0 ? '' : 'bg-rally-navy/[0.01]'}`}>
                <td className="px-4 py-3">
                  <span className={`font-display font-bold text-lg ${
                    i === 0 ? 'text-rally-yellow' : i === 1 ? 'text-rally-slate-light' : i === 2 ? 'text-rally-red' : 'text-rally-navy/30'
                  }`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{entry.name}</td>
                <td className="px-4 py-3 font-mono">{entry.contacts}</td>
                <td className="px-4 py-3 font-mono text-rally-yellow">{entry.contacted}</td>
                <td className="px-4 py-3 font-mono text-rally-green font-bold">{entry.supporters}</td>
                <td className="px-4 py-3 font-mono">{entry.contact_rate}%</td>
                <td className="px-4 py-3 font-mono font-bold text-rally-green">{entry.conversion_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
