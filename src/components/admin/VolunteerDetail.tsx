'use client'

import { useState, useEffect } from 'react'

interface Props {
  userId: string
  onBack: () => void
}

interface ContactRow {
  id: string
  first_name: string
  last_name: string
  category: string
  city: string
  zip: string
  match_status: string
  vote_score: number | null
  segment: string | null
  outreach_method: string | null
  contact_outcome: string | null
  notes: string | null
  contacted: number
}

export default function VolunteerDetail({ userId, onBack }: Props) {
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null)
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/volunteers/${userId}`)
      .then(res => res.json())
      .then(data => {
        setUser(data.user)
        setContacts(data.contacts || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div className="text-center py-12 text-vc-gray">Loading...</div>

  return (
    <div>
      <button onClick={onBack} className="text-sm text-vc-coral font-bold hover:underline mb-4 flex items-center gap-1">
        ← Back to Volunteers
      </button>

      {user && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4 shadow-sm">
          <h2 className="font-display font-bold text-xl">{user.name}</h2>
          <p className="text-sm text-vc-gray">{user.email} · {user.role}</p>
          <p className="text-xs text-vc-gray mt-1">{contacts.length} contacts</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-vc-purple/[0.03] border-b border-gray-100">
                {['Name', 'Category', 'City', 'Match', 'Score', 'Segment', 'Method', 'Outcome', 'Notes'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-vc-gray">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? '' : 'bg-vc-purple/[0.01]'}>
                  <td className="px-3 py-2.5 font-medium">{c.first_name} {c.last_name}</td>
                  <td className="px-3 py-2.5 text-xs text-vc-gray">{c.category}</td>
                  <td className="px-3 py-2.5 text-xs">{c.city || '-'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      c.match_status === 'confirmed' ? 'bg-vc-teal/10 text-vc-teal' :
                      c.match_status === 'ambiguous' ? 'bg-vc-gold/20 text-vc-gold' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {c.match_status || 'pending'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-display tabular-nums text-xs">{c.vote_score != null ? `${Math.round(c.vote_score * 100)}%` : '-'}</td>
                  <td className="px-3 py-2.5 text-xs">{c.segment || '-'}</td>
                  <td className="px-3 py-2.5 text-xs">{c.outreach_method || '-'}</td>
                  <td className="px-3 py-2.5">
                    {c.contact_outcome && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        c.contact_outcome === 'supporter' ? 'bg-vc-teal/10 text-vc-teal' :
                        c.contact_outcome === 'undecided' ? 'bg-vc-gold/20 text-vc-gold' :
                        c.contact_outcome === 'opposed' ? 'bg-vc-coral/10 text-vc-coral' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {c.contact_outcome}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-vc-gray max-w-[200px] truncate">{c.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
