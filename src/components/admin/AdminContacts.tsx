'use client'

import { useState, useEffect } from 'react'

interface AdminContactRow {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  category: string
  city: string
  zip: string
  volunteer_name: string
  volunteer_email: string
  match_status: string
  vote_score: number | null
  segment: string | null
  outreach_method: string | null
  contact_outcome: string | null
  notes: string | null
  contacted: number
  created_at: string
}

export default function AdminContacts() {
  const [contacts, setContacts] = useState<AdminContactRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set('search', search)

    fetch(`/api/admin/contacts?${params}`)
      .then(res => res.json())
      .then(data => {
        setContacts(data.contacts || [])
        setTotalPages(data.totalPages || 1)
        setTotal(data.total || 0)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search])

  return (
    <div>
      {/* Search and count */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm w-64 focus:ring-2 focus:ring-vc-coral focus:border-transparent outline-none"
        />
        <span className="text-xs text-vc-gray font-display tabular-nums whitespace-nowrap">{total} total contacts</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-vc-gray">Loading contacts...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-vc-purple/[0.03] border-b border-gray-100">
                  {['Volunteer', 'Contact', 'Category', 'City', 'Match', 'Segment', 'Outcome', 'Created'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-vc-gray">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c, i) => (
                  <tr key={c.id} className={i % 2 === 0 ? '' : 'bg-vc-purple/[0.01]'}>
                    <td className="px-3 py-2.5 text-xs text-vc-gray">{c.volunteer_name}</td>
                    <td className="px-3 py-2.5 font-medium">{c.first_name} {c.last_name}</td>
                    <td className="px-3 py-2.5 text-xs">{c.category}</td>
                    <td className="px-3 py-2.5 text-xs">{c.city || '-'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        c.match_status === 'confirmed' ? 'bg-vc-teal/10 text-vc-teal' :
                        c.match_status === 'ambiguous' ? 'bg-vc-gold/20 text-vc-gold' :
                        'bg-gray-100 text-gray-400'
                      }`}>{c.match_status || 'pending'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{c.segment || '-'}</td>
                    <td className="px-3 py-2.5">
                      {c.contact_outcome && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          c.contact_outcome === 'supporter' ? 'bg-vc-teal/10 text-vc-teal' :
                          c.contact_outcome === 'undecided' ? 'bg-vc-gold/20 text-vc-gold' :
                          c.contact_outcome === 'opposed' ? 'bg-vc-coral/10 text-vc-coral' :
                          'bg-gray-100 text-gray-500'
                        }`}>{c.contact_outcome}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-vc-gray">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-3 border-t border-gray-100">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-vc-purple/5 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-xs text-vc-gray font-display tabular-nums">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-vc-purple/5 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
