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
  const [resetPassword, setResetPassword] = useState('')
  const [resetStatus, setResetStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [resetting, setResetting] = useState(false)

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

  if (loading) return <div className="text-center py-12 text-white/50">Loading...</div>

  return (
    <div>
      <button onClick={onBack} className="text-sm text-vc-coral font-bold hover:underline mb-4 flex items-center gap-1 text-white/60 hover:text-white">
        ← Back to Volunteers
      </button>

      {user && (
        <div className="glass-card p-5 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display font-bold text-xl text-white">{user.name}</h2>
              <p className="text-sm text-white/50">{user.email} · {user.role}</p>
              <p className="text-xs text-white/40 mt-1">{contacts.length} contacts</p>
            </div>

            {/* Reset Password */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={resetPassword}
                onChange={e => { setResetPassword(e.target.value); setResetStatus(null) }}
                placeholder="New password (8+ chars)"
                className="glass-input px-3 py-2 rounded-btn text-xs w-44"
              />
              <button
                onClick={async () => {
                  if (resetPassword.length < 8) {
                    setResetStatus({ type: 'error', message: 'Min 8 characters' })
                    return
                  }
                  setResetting(true)
                  setResetStatus(null)
                  try {
                    const res = await fetch('/api/auth/reset-password', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId, newPassword: resetPassword }),
                    })
                    const data = await res.json()
                    if (res.ok) {
                      setResetStatus({ type: 'success', message: 'Password reset!' })
                      setResetPassword('')
                    } else {
                      setResetStatus({ type: 'error', message: data.error || 'Failed' })
                    }
                  } catch {
                    setResetStatus({ type: 'error', message: 'Network error' })
                  } finally {
                    setResetting(false)
                  }
                }}
                disabled={resetting || resetPassword.length < 8}
                className="bg-vc-purple text-white px-4 py-2 rounded-btn text-xs font-bold hover:bg-vc-purple-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {resetting ? '...' : 'Reset Password'}
              </button>
              {resetStatus && (
                <span className={`text-[10px] font-bold ${resetStatus.type === 'success' ? 'text-vc-teal' : 'text-vc-coral'}`}>
                  {resetStatus.message}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {['Name', 'Category', 'City', 'Match', 'Score', 'Segment', 'Method', 'Outcome', 'Notes'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/40">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => (
                <tr key={c.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                  <td className="px-3 py-2.5 font-medium text-white">{c.first_name} {c.last_name}</td>
                  <td className="px-3 py-2.5 text-xs text-white/50">{c.category}</td>
                  <td className="px-3 py-2.5 text-xs text-white/60">{c.city || '-'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      c.match_status === 'confirmed' ? 'bg-vc-teal/10 text-vc-teal' :
                      c.match_status === 'ambiguous' ? 'bg-vc-gold/20 text-vc-gold' :
                      'bg-white/10 text-white/40'
                    }`}>
                      {c.match_status || 'pending'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-display tabular-nums text-xs text-white">{c.vote_score != null ? `${Math.round(c.vote_score * 100)}%` : '-'}</td>
                  <td className="px-3 py-2.5 text-xs text-white/60">{c.segment || '-'}</td>
                  <td className="px-3 py-2.5 text-xs text-white/60">{c.outreach_method || '-'}</td>
                  <td className="px-3 py-2.5">
                    {c.contact_outcome && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        c.contact_outcome === 'supporter' ? 'bg-vc-teal/10 text-vc-teal' :
                        c.contact_outcome === 'undecided' ? 'bg-vc-gold/20 text-vc-gold' :
                        c.contact_outcome === 'opposed' ? 'bg-vc-coral/10 text-vc-coral' :
                        'bg-white/10 text-white/50'
                      }`}>
                        {c.contact_outcome}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-white/50 max-w-[200px] truncate">{c.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
