'use client'

import { useState, useEffect } from 'react'
import VolunteerDetail from './VolunteerDetail'

interface VolunteerRow {
  id: string
  name: string
  email: string
  created_at: string
  contact_count: number
  matched_count: number
  contacted_count: number
  supporter_count: number
  undecided_count: number
  opposed_count: number
}

export default function VolunteerList() {
  const [volunteers, setVolunteers] = useState<VolunteerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/volunteers')
      .then(res => res.json())
      .then(data => setVolunteers(data.volunteers || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (selectedId) {
    return <VolunteerDetail userId={selectedId} onBack={() => setSelectedId(null)} />
  }

  if (loading) return <div className="text-center py-12 text-white/50">Loading volunteers...</div>

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {['Name', 'Email', 'Contacts', 'Matched', 'Contacted', 'Supporters', 'Joined'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {volunteers.map((vol, i) => (
              <tr
                key={vol.id}
                onClick={() => setSelectedId(vol.id)}
                className={`cursor-pointer border-b border-white/5 hover:bg-white/5 transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}
              >
                <td className="px-4 py-3 font-medium text-white">{vol.name}</td>
                <td className="px-4 py-3 text-white/50">{vol.email}</td>
                <td className="px-4 py-3 font-display tabular-nums text-white">{vol.contact_count}</td>
                <td className="px-4 py-3 font-display tabular-nums text-vc-teal">{vol.matched_count}</td>
                <td className="px-4 py-3 font-display tabular-nums text-vc-gold">{vol.contacted_count}</td>
                <td className="px-4 py-3 font-display tabular-nums text-vc-teal">{vol.supporter_count}</td>
                <td className="px-4 py-3 text-white/50 text-xs">{new Date(vol.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {volunteers.length === 0 && (
        <div className="text-center py-12 text-white/50">No volunteers yet</div>
      )}
    </div>
  )
}
