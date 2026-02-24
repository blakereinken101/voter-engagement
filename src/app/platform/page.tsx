'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'
import {
  BarChart3, Building2, Users, CreditCard, Loader2, Search,
  Plus, Check, X, Shield, ShieldOff,
} from 'lucide-react'

type PlatformTab = 'overview' | 'organizations' | 'users' | 'subscriptions'

const TABS: { id: PlatformTab; label: string; Icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'Overview', Icon: BarChart3 },
  { id: 'organizations', label: 'Organizations', Icon: Building2 },
  { id: 'users', label: 'Users', Icon: Users },
  { id: 'subscriptions', label: 'Subscriptions', Icon: CreditCard },
]

// ========== OVERVIEW ==========

interface Stats {
  totalOrganizations: number
  totalUsers: number
  totalActiveCampaigns: number
  activeSubscriptions: number
  totalEvents: number
  totalRsvps: number
  newUsersLast30Days: number
  newOrgsLast30Days: number
}

function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/platform/stats').then(r => r.json()).then(setStats)
  }, [])

  if (!stats) return <LoadingState />

  const cards = [
    { label: 'Organizations', value: stats.totalOrganizations, delta: stats.newOrgsLast30Days, color: 'text-vc-purple-light', bg: 'bg-vc-purple/20' },
    { label: 'Users', value: stats.totalUsers, delta: stats.newUsersLast30Days, color: 'text-vc-teal', bg: 'bg-vc-teal/20' },
    { label: 'Active Subscriptions', value: stats.activeSubscriptions, delta: null, color: 'text-yellow-400', bg: 'bg-yellow-400/20' },
    { label: 'Events', value: stats.totalEvents, delta: stats.totalRsvps, color: 'text-vc-coral', bg: 'bg-vc-coral/20', deltaLabel: 'RSVPs' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <div key={card.label} className="glass-card p-5">
          <p className="text-white/50 text-sm">{card.label}</p>
          <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value.toLocaleString()}</p>
          {card.delta !== null && (
            <p className="text-white/40 text-xs mt-2">
              +{card.delta} {card.deltaLabel || 'last 30d'}
            </p>
          )}
        </div>
      ))}

      <div className="col-span-2 lg:col-span-4 glass-card p-5">
        <p className="text-white/50 text-sm">Active Campaigns</p>
        <p className="text-3xl font-bold mt-1 text-white">{stats.totalActiveCampaigns}</p>
      </div>
    </div>
  )
}

// ========== ORGANIZATIONS ==========

interface Org {
  id: string
  name: string
  slug: string
  created_at: string
  campaign_count: number
  user_count: number
  subscription_plan: string | null
  subscription_status: string | null
}

function OrganizationsTab() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/platform/organizations')
      .then(r => r.json())
      .then(d => setOrgs(d.organizations || []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim() || !formSlug.trim()) return
    setCreating(true)
    await fetch('/api/platform/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: formName.trim(), slug: formSlug.trim() }),
    })
    setFormName('')
    setFormSlug('')
    setShowForm(false)
    setCreating(false)
    load()
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-sm">{orgs.length} organization{orgs.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium bg-vc-purple text-white hover:bg-vc-purple-light transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="glass-card p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-white/50 mb-1">Name</label>
            <input
              value={formName}
              onChange={e => {
                setFormName(e.target.value)
                setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 50))
              }}
              className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm"
              placeholder="Organization name"
              required
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-white/50 mb-1">Slug</label>
            <input
              value={formSlug}
              onChange={e => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm font-mono"
              placeholder="org-slug"
              required
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 rounded-btn text-sm font-medium bg-vc-teal text-white hover:bg-vc-teal/80 transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="px-4 py-2 rounded-btn text-sm text-white/50 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-white/50 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Slug</th>
                <th className="text-center px-4 py-3 text-white/50 font-medium">Users</th>
                <th className="text-center px-4 py-3 text-white/50 font-medium">Campaigns</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Subscription</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(org => (
                <tr key={org.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{org.name}</td>
                  <td className="px-4 py-3 text-white/50 font-mono text-xs">{org.slug}</td>
                  <td className="px-4 py-3 text-center text-white/70">{org.user_count}</td>
                  <td className="px-4 py-3 text-center text-white/70">{org.campaign_count}</td>
                  <td className="px-4 py-3">
                    {org.subscription_plan ? (
                      <StatusPill status={org.subscription_status} label={org.subscription_plan} />
                    ) : (
                      <span className="text-white/30 text-xs">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs">{formatDate(org.created_at)}</td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-white/30">No organizations yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ========== USERS ==========

interface PlatformUser {
  id: string
  email: string
  name: string
  is_platform_admin: boolean
  created_at: string
  membership_count: number
}

function UsersTab() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/platform/users')
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .finally(() => setLoading(false))
  }, [])

  async function toggleAdmin(userId: string, current: boolean) {
    if (userId === currentUser?.id) return
    setToggling(userId)
    const res = await fetch(`/api/platform/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_platform_admin: !current }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_platform_admin: !current } : u))
    }
    setToggling(null)
  }

  if (loading) return <LoadingState />

  const filtered = search
    ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    : users

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="glass-input w-full pl-9 pr-3 py-2 rounded-btn text-white text-sm"
            placeholder="Search users..."
          />
        </div>
        <p className="text-white/50 text-sm">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-white/50 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Email</th>
                <th className="text-center px-4 py-3 text-white/50 font-medium">Admin</th>
                <th className="text-center px-4 py-3 text-white/50 font-medium">Memberships</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-white/60 text-xs">{u.email}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleAdmin(u.id, u.is_platform_admin)}
                      disabled={toggling === u.id || u.id === currentUser?.id}
                      className={clsx(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors',
                        u.is_platform_admin
                          ? 'bg-vc-coral/20 text-vc-coral border border-vc-coral/30 hover:bg-vc-coral/30'
                          : 'bg-white/5 text-white/30 border border-white/10 hover:bg-white/10',
                        (toggling === u.id || u.id === currentUser?.id) && 'opacity-50 cursor-not-allowed'
                      )}
                      title={u.id === currentUser?.id ? 'Cannot modify your own status' : u.is_platform_admin ? 'Remove admin' : 'Make admin'}
                    >
                      {toggling === u.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : u.is_platform_admin ? (
                        <Shield className="w-3 h-3" />
                      ) : (
                        <ShieldOff className="w-3 h-3" />
                      )}
                      {u.is_platform_admin ? 'Admin' : 'User'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center text-white/70">{u.membership_count}</td>
                  <td className="px-4 py-3 text-white/50 text-xs">{formatDate(u.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-white/30">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ========== SUBSCRIPTIONS ==========

interface Subscription {
  id: string
  organization_name: string
  organization_slug: string
  product: string
  plan: string
  status: string
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
}

function SubscriptionsTab() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/platform/subscriptions')
      .then(r => r.json())
      .then(d => setSubs(d.subscriptions || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <p className="text-white/50 text-sm">{subs.length} subscription{subs.length !== 1 ? 's' : ''}</p>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-white/50 font-medium">Organization</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Product</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Plan</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Period Start</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Period End</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(sub => (
                <tr key={sub.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-vc-purple-light font-medium">{sub.organization_name}</td>
                  <td className="px-4 py-3 text-white/70 capitalize">{sub.product}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-vc-purple/20 text-vc-purple-light border border-vc-purple/30 capitalize">
                      {sub.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={sub.status} label={sub.status} />
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs">{sub.current_period_start ? formatDate(sub.current_period_start) : '—'}</td>
                  <td className="px-4 py-3 text-white/50 text-xs">{sub.current_period_end ? formatDate(sub.current_period_end) : '—'}</td>
                </tr>
              ))}
              {subs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-white/30">No subscriptions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ========== SHARED COMPONENTS ==========

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
    </div>
  )
}

function StatusPill({ status, label }: { status: string | null; label: string }) {
  const colors: Record<string, string> = {
    active: 'bg-vc-teal/20 text-vc-teal border-vc-teal/30',
    trialing: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
    past_due: 'bg-red-400/20 text-red-400 border-red-400/30',
    cancelled: 'bg-white/10 text-white/40 border-white/20',
    canceled: 'bg-white/10 text-white/40 border-white/20',
  }

  return (
    <span className={clsx(
      'inline-block px-2 py-0.5 rounded-full text-xs font-medium border capitalize',
      colors[status || ''] || 'bg-white/10 text-white/40 border-white/20'
    )}>
      {label}
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ========== MAIN PAGE ==========

export default function PlatformPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<PlatformTab>('overview')

  useEffect(() => {
    if (!isLoading && (!user || !user.isPlatformAdmin)) {
      router.push('/dashboard')
    }
  }, [isLoading, user, router])

  if (isLoading || !user?.isPlatformAdmin) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 glass-card p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 rounded-btn text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-vc-purple text-white shadow-glow'
                : 'text-white/60 hover:bg-white/10'
            )}
          >
            <tab.Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'organizations' && <OrganizationsTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'subscriptions' && <SubscriptionsTab />}
      </div>
    </div>
  )
}
