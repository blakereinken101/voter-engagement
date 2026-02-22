'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Link2, Copy, Check, Trash2, Clock, Users } from 'lucide-react'
import clsx from 'clsx'

interface InvitationRow {
  id: string
  email: string | null
  role: string
  token: string
  expires_at: string
  accepted_at: string | null
  max_uses: number
  use_count: number
  created_at: string
  inviter_name: string
}

interface MemberRow {
  id: string
  name: string
  email: string
  role: string
  joinedAt: string
}

const ROLE_LABELS: Record<string, string> = {
  volunteer: 'Volunteer',
  organizer: 'Organizer',
  campaign_admin: 'Admin',
}

export default function TeamManagement() {
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('volunteer')
  const [inviteType, setInviteType] = useState<'email' | 'link'>('link')
  const [maxUses, setMaxUses] = useState(10)
  const [expiresInDays, setExpiresInDays] = useState(7)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [invRes, memRes] = await Promise.all([
        fetch('/api/invitations'),
        fetch('/api/admin/volunteers'),
      ])
      const invData = await invRes.json()
      const memData = await memRes.json()
      setInvitations(invData.invitations || [])

      // Transform volunteer data into member rows
      const memberRows = (memData.volunteers || []).map((v: { id: string; name: string; email: string }) => ({
        id: v.id,
        name: v.name,
        email: v.email,
        role: 'volunteer',
        joinedAt: '',
      }))
      setMembers(memberRows)
    } catch {
      setError('Failed to load team data')
    } finally {
      setLoading(false)
    }
  }

  async function createInvitation(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    setNewInviteUrl(null)

    try {
      const body: Record<string, unknown> = {
        role: inviteRole,
        expiresInDays,
      }
      if (inviteType === 'email' && inviteEmail) {
        body.email = inviteEmail
        body.maxUses = 1
      } else {
        body.maxUses = maxUses
      }

      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create invitation')

      const inviteUrl = `${window.location.origin}${data.invitation.inviteUrl}`
      setNewInviteUrl(inviteUrl)
      setShowInviteForm(false)
      setInviteEmail('')
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invitation')
    } finally {
      setSubmitting(false)
    }
  }

  async function revokeInvitation(id: string) {
    try {
      await fetch(`/api/invitations?id=${id}`, { method: 'DELETE' })
      setInvitations(prev => prev.filter(i => i.id !== id))
    } catch {
      setError('Failed to revoke invitation')
    }
  }

  function copyToClipboard(text: string, token: string) {
    navigator.clipboard.writeText(text)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  if (loading) return <div className="text-center py-12 text-white/50">Loading team...</div>

  const activeInvitations = invitations.filter(i =>
    !i.accepted_at && new Date(i.expires_at) > new Date() && i.use_count < i.max_uses
  )
  const usedInvitations = invitations.filter(i =>
    i.accepted_at || new Date(i.expires_at) <= new Date() || i.use_count >= i.max_uses
  )

  return (
    <div className="space-y-6">
      {/* New invite URL banner */}
      {newInviteUrl && (
        <div className="glass-card p-4 border border-vc-teal/30 bg-vc-teal/5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-vc-teal mb-1">Invite link created!</p>
              <p className="text-xs text-white/60 truncate font-mono">{newInviteUrl}</p>
            </div>
            <button
              onClick={() => copyToClipboard(newInviteUrl, 'new')}
              className="flex-shrink-0 flex items-center gap-1.5 bg-vc-teal/20 text-vc-teal px-3 py-1.5 rounded-btn text-sm font-bold hover:bg-vc-teal/30 transition-colors"
            >
              {copiedToken === 'new' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedToken === 'new' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 text-red-300 text-sm px-4 py-3 rounded-lg border border-red-500/30">
          {error}
        </div>
      )}

      {/* Create invite button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-vc-purple-light" />
          Team ({members.length} members)
        </h3>
        <button
          onClick={() => setShowInviteForm(!showInviteForm)}
          className="flex items-center gap-2 bg-vc-purple hover:bg-vc-purple-light text-white font-bold px-4 py-2 rounded-btn text-sm shadow-glow transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Invite
        </button>
      </div>

      {/* Invite form */}
      {showInviteForm && (
        <form onSubmit={createInvitation} className="glass-card p-5 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInviteType('link')}
              className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-btn text-sm font-medium', inviteType === 'link' ? 'bg-vc-purple text-white' : 'text-white/60 glass')}
            >
              <Link2 className="w-4 h-4" /> Invite Link
            </button>
            <button
              type="button"
              onClick={() => setInviteType('email')}
              className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-btn text-sm font-medium', inviteType === 'email' ? 'bg-vc-purple text-white' : 'text-white/60 glass')}
            >
              <UserPlus className="w-4 h-4" /> Email Invite
            </button>
          </div>

          {inviteType === 'email' && (
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1">Email</label>
              <input
                type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="volunteer@example.com" required
                className="glass-input w-full rounded-btn h-10 px-3 text-sm"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1">Role</label>
              <select
                value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                className="glass-input w-full rounded-btn h-10 px-3 text-sm bg-transparent"
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value} className="bg-vc-bg">{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1">Expires in</label>
              <select
                value={expiresInDays} onChange={e => setExpiresInDays(parseInt(e.target.value))}
                className="glass-input w-full rounded-btn h-10 px-3 text-sm bg-transparent"
              >
                <option value={1} className="bg-vc-bg">1 day</option>
                <option value={3} className="bg-vc-bg">3 days</option>
                <option value={7} className="bg-vc-bg">7 days</option>
                <option value={14} className="bg-vc-bg">14 days</option>
                <option value={30} className="bg-vc-bg">30 days</option>
              </select>
            </div>
          </div>

          {inviteType === 'link' && (
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-1">Max uses</label>
              <input
                type="number" value={maxUses} onChange={e => setMaxUses(parseInt(e.target.value) || 1)}
                min={1} max={1000}
                className="glass-input w-full rounded-btn h-10 px-3 text-sm"
              />
              <p className="text-xs text-white/40 mt-1">How many people can use this link</p>
            </div>
          )}

          <button
            type="submit" disabled={submitting}
            className="w-full bg-vc-purple hover:bg-vc-purple-light text-white font-bold py-2.5 rounded-btn text-sm transition-all disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Invitation'}
          </button>
        </form>
      )}

      {/* Active invitations */}
      {activeInvitations.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-white/60 mb-2 flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Active Invitations ({activeInvitations.length})
          </h4>
          <div className="space-y-2">
            {activeInvitations.map(inv => (
              <div key={inv.id} className="glass-card p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-vc-purple/20 text-vc-purple-light font-bold">
                      {ROLE_LABELS[inv.role] || inv.role}
                    </span>
                    {inv.email && (
                      <span className="text-sm text-white/70 truncate">{inv.email}</span>
                    )}
                    {!inv.email && (
                      <span className="text-xs text-white/40">Invite link</span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-1">
                    {inv.use_count}/{inv.max_uses} used
                    {' · '}Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => copyToClipboard(`${window.location.origin}/invite/${inv.token}`, inv.token)}
                    className="p-2 text-white/40 hover:text-white transition-colors"
                    title="Copy invite link"
                  >
                    {copiedToken === inv.token ? <Check className="w-4 h-4 text-vc-teal" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => revokeInvitation(inv.id)}
                    className="p-2 text-white/40 hover:text-red-400 transition-colors"
                    title="Revoke invitation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Used/expired invitations */}
      {usedInvitations.length > 0 && (
        <details className="group">
          <summary className="text-sm font-bold text-white/40 cursor-pointer hover:text-white/60 transition-colors mb-2">
            Past Invitations ({usedInvitations.length})
          </summary>
          <div className="space-y-2">
            {usedInvitations.slice(0, 10).map(inv => (
              <div key={inv.id} className="glass-card p-3 opacity-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                    {ROLE_LABELS[inv.role] || inv.role}
                  </span>
                  {inv.email && <span className="text-sm text-white/40 truncate">{inv.email}</span>}
                  <span className="text-xs text-white/30 ml-auto">
                    {inv.accepted_at ? 'Accepted' : inv.use_count >= inv.max_uses ? 'Fully used' : 'Expired'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
