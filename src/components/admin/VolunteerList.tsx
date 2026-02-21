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

  if (loading) return <div className="text-center py-12 text-rally-slate-light">Loading volunteers...</div>

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-rally-navy/[0.03] border-b border-gray-100">
              {['Name', 'Email', 'Contacts', 'Matched', 'Contacted', 'Supporters', 'Joined'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-rally-slate-light">
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
                className={`cursor-pointer hover:bg-rally-navy/[0.02] transition-colors ${i % 2 === 0 ? '' : 'bg-rally-navy/[0.01]'}`}
              >
                <td className="px-4 py-3 font-medium">{vol.name}</td>
                <td className="px-4 py-3 text-rally-slate-light">{vol.email}</td>
                <td className="px-4 py-3 font-mono">{vol.contact_count}</td>
                <td className="px-4 py-3 font-mono text-rally-green">{vol.matched_count}</td>
                <td className="px-4 py-3 font-mono text-rally-yellow">{vol.contacted_count}</td>
                <td className="px-4 py-3 font-mono text-rally-green">{vol.supporter_count}</td>
                <td className="px-4 py-3 text-rally-slate-light text-xs">{new Date(vol.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {volunteers.length === 0 && (
        <div className="text-center py-12 text-rally-slate-light">No volunteers yet</div>
      )}
    </div>
  )
}
