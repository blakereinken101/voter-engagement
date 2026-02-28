'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'
import NextLink from 'next/link'
import {
  BarChart3, Building2, Users, CreditCard, Loader2, Search,
  Plus, Check, X, Shield, ShieldOff, Database, Upload, Trash2,
  ChevronDown, ChevronRight, Link as LinkIcon, MessageSquare, Calendar, UserPlus,
  Settings, RotateCcw, FileText, ExternalLink, Megaphone, Pencil,
} from 'lucide-react'

type PlatformTab = 'overview' | 'organizations' | 'campaigns' | 'users' | 'subscriptions' | 'voter-data' | 'settings'

const TABS: { id: PlatformTab; label: string; Icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'Overview', Icon: BarChart3 },
  { id: 'organizations', label: 'Organizations', Icon: Building2 },
  { id: 'campaigns', label: 'Campaigns', Icon: Megaphone },
  { id: 'users', label: 'Users', Icon: Users },
  { id: 'subscriptions', label: 'Subscriptions', Icon: CreditCard },
  { id: 'voter-data', label: 'Voter Data', Icon: Database },
  { id: 'settings', label: 'Settings', Icon: Settings },
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

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

  async function handleRename(orgId: string) {
    if (!editName.trim()) return
    setSaving(true)
    const res = await fetch('/api/platform/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orgId, name: editName.trim() }),
    })
    if (res.ok) {
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, name: editName.trim() } : o))
    }
    setEditingId(null)
    setSaving(false)
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
                  <td className="px-4 py-3 text-white font-medium">
                    {editingId === org.id ? (
                      <form
                        className="inline-flex items-center gap-1.5"
                        onSubmit={e => { e.preventDefault(); handleRename(org.id) }}
                      >
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="glass-input px-2 py-1 rounded text-sm text-white w-48"
                          autoFocus
                        />
                        <button type="submit" disabled={saving} className="text-vc-teal hover:text-vc-teal/80">
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="text-white/30 hover:text-white/60">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-vc-purple-light transition-colors"
                        onClick={() => { setEditingId(org.id); setEditName(org.name) }}
                        title="Click to rename"
                      >
                        {org.name}
                      </span>
                    )}
                  </td>
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

// ========== CAMPAIGNS ==========

interface CampaignListItem {
  id: string
  name: string
  slug: string
  org_id: string
  org_name: string
  state: string
  candidate_name: string | null
  election_date: string | null
  is_active: boolean
  member_count: number
  dataset_count: number
  created_at: string
}

interface CampaignDetail {
  campaign: CampaignListItem & { settings: Record<string, unknown> }
  members: {
    id: string; user_id: string; user_name: string; user_email: string
    role: string; is_active: boolean; joined_at: string
  }[]
  voterDatasets: {
    dataset_id: string; dataset_name: string; dataset_state: string
    record_count: number; status: string
    filter_congressional: string | null; filter_state_senate: string | null
    filter_state_house: string | null; filter_city: string | null; filter_zip: string | null
  }[]
  availableDatasets: { id: string; name: string; state: string; record_count: number }[]
}

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailCache, setDetailCache] = useState<Record<string, CampaignDetail>>({})

  // Create form state
  const [formOrgId, setFormOrgId] = useState('')
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formState, setFormState] = useState('')
  const [formCandidate, setFormCandidate] = useState('')
  const [formElectionDate, setFormElectionDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([])

  const loadCampaigns = useCallback(() => {
    setLoading(true)
    fetch('/api/platform/campaigns')
      .then(r => r.json())
      .then(d => setCampaigns(d.relationalCampaigns || []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadCampaigns() }, [loadCampaigns])

  useEffect(() => {
    fetch('/api/platform/organizations')
      .then(r => r.json())
      .then(d => setOrgs((d.organizations || []).map((o: Org) => ({ id: o.id, name: o.name }))))
  }, [])

  async function loadDetail(campaignId: string) {
    if (detailCache[campaignId]) return
    const res = await fetch(`/api/platform/campaigns/${campaignId}`)
    if (res.ok) {
      const data = await res.json()
      setDetailCache(prev => ({ ...prev, [campaignId]: data }))
    }
  }

  function refreshDetail(campaignId: string) {
    setDetailCache(prev => {
      const copy = { ...prev }
      delete copy[campaignId]
      return copy
    })
    loadDetail(campaignId)
    loadCampaigns()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    if (!formOrgId || !formName.trim() || !formSlug.trim() || !formState) {
      setCreateError('Organization, name, slug, and state are required')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/platform/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: formOrgId,
          name: formName.trim(),
          slug: formSlug.trim(),
          state: formState,
          candidateName: formCandidate.trim() || undefined,
          electionDate: formElectionDate || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error || 'Failed to create'); return }
      setFormName(''); setFormSlug(''); setFormCandidate(''); setFormElectionDate('')
      setFormOrgId(''); setShowForm(false)
      loadCampaigns()
    } catch { setCreateError('Network error') } finally { setCreating(false) }
  }

  async function toggleActive(id: string, current: boolean) {
    await fetch('/api/platform/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !current }),
    })
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, is_active: !current } : c))
  }

  if (loading) return <LoadingState />

  const US_STATES_LIST = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

  const filtered = search
    ? campaigns.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.org_name.toLowerCase().includes(search.toLowerCase()) ||
        c.candidate_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.state.toLowerCase().includes(search.toLowerCase())
      )
    : campaigns

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <p className="text-white/50 text-sm">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="glass-input pl-8 pr-3 py-1.5 rounded-btn text-white text-sm w-56"
            />
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium bg-vc-purple text-white hover:bg-vc-purple-light transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="glass-card p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">Organization</label>
              <select
                value={formOrgId}
                onChange={e => setFormOrgId(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm bg-transparent"
                required
              >
                <option value="" disabled className="bg-vc-surface">Select org...</option>
                {orgs.map(o => (
                  <option key={o.id} value={o.id} className="bg-vc-surface">{o.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Campaign Name</label>
              <input
                value={formName}
                onChange={e => {
                  setFormName(e.target.value)
                  setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 50))
                }}
                className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm"
                placeholder="My Campaign 2026"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Slug</label>
              <input
                value={formSlug}
                onChange={e => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm font-mono"
                placeholder="my-campaign-2026"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">State</label>
              <select
                value={formState}
                onChange={e => setFormState(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm bg-transparent"
                required
              >
                <option value="" disabled className="bg-vc-surface">Select state...</option>
                {US_STATES_LIST.map(s => <option key={s} value={s} className="bg-vc-surface">{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Candidate Name <span className="text-white/30">(optional)</span></label>
              <input
                value={formCandidate}
                onChange={e => setFormCandidate(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Election Date <span className="text-white/30">(optional)</span></label>
              <input
                type="date"
                value={formElectionDate}
                onChange={e => setFormElectionDate(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm bg-transparent"
              />
            </div>
          </div>
          {createError && <p className="text-red-400 text-xs">{createError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-btn text-sm font-medium bg-vc-teal text-white hover:bg-vc-teal/80 transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setCreateError('') }}
              className="px-4 py-2 rounded-btn text-sm text-white/50 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="w-8 px-2 py-3" />
                <th className="text-left px-4 py-3 text-white/50 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Organization</th>
                <th className="text-center px-4 py-3 text-white/50 font-medium">State</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Candidate</th>
                <th className="text-center px-4 py-3 text-white/50 font-medium">Status</th>
                <th className="text-center px-4 py-3 text-white/50 font-medium">Members</th>
                <th className="text-center px-4 py-3 text-white/50 font-medium">Datasets</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <React.Fragment key={c.id}>
                  <tr
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => {
                      const next = expandedId === c.id ? null : c.id
                      setExpandedId(next)
                      if (next) loadDetail(next)
                    }}
                  >
                    <td className="px-2 py-3 text-white/30">
                      {expandedId === c.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-white/60">{c.org_name}</td>
                    <td className="px-4 py-3 text-center text-white/60 font-mono text-xs">{c.state}</td>
                    <td className="px-4 py-3 text-white/60">{c.candidate_name || <span className="text-white/20">—</span>}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusPill status={c.is_active ? 'active' : 'inactive'} label={c.is_active ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="px-4 py-3 text-center text-white/70">{c.member_count}</td>
                    <td className="px-4 py-3 text-center text-white/70">{c.dataset_count}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">{formatDate(c.created_at)}</td>
                  </tr>
                  {expandedId === c.id && (
                    <tr className="bg-white/[0.02]">
                      <td colSpan={9} className="px-6 py-4">
                        <CampaignExpandedRow
                          campaignId={c.id}
                          campaign={c}
                          detail={detailCache[c.id]}
                          onRefresh={refreshDetail}
                          onToggleActive={toggleActive}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-white/30">
                  {search ? 'No campaigns match your search' : 'No campaigns yet'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CampaignExpandedRow({
  campaignId,
  campaign,
  detail,
  onRefresh,
  onToggleActive,
}: {
  campaignId: string
  campaign: CampaignListItem
  detail?: CampaignDetail
  onRefresh: (campaignId: string) => void
  onToggleActive: (id: string, current: boolean) => void
}) {
  const [assigning, setAssigning] = useState(false)
  const [selectedDataset, setSelectedDataset] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [geoOptions, setGeoOptions] = useState<GeoOptions | null>(null)
  const [filterHouse, setFilterHouse] = useState('')
  const [filterSenate, setFilterSenate] = useState('')
  const [filterCongressional, setFilterCongressional] = useState('')
  const [filterCity, setFilterCity] = useState('')

  // Inline edit state
  const [editing, setEditing] = useState<'state' | 'election_date' | 'candidate' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const EDIT_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

  function startEdit(field: 'state' | 'election_date' | 'candidate') {
    setEditing(field)
    if (field === 'state') setEditValue(campaign.state || '')
    else if (field === 'election_date') setEditValue(campaign.election_date ? campaign.election_date.split('T')[0] : '')
    else if (field === 'candidate') setEditValue(campaign.candidate_name || '')
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    const body: Record<string, unknown> = { id: campaignId }
    if (editing === 'state') body.state = editValue
    else if (editing === 'election_date') body.electionDate = editValue || null
    else if (editing === 'candidate') body.candidateName = editValue || null
    try {
      const res = await fetch('/api/platform/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setEditing(null)
        onRefresh(campaignId)
      }
    } finally { setSaving(false) }
  }

  // Load geo options when a dataset is selected
  useEffect(() => {
    if (!selectedDataset) { setGeoOptions(null); return }
    fetch(`/api/platform/voter-datasets/${selectedDataset}`)
      .then(r => r.json())
      .then(d => setGeoOptions(d.geoOptions || null))
  }, [selectedDataset])

  if (!detail) return <LoadingState />

  function formatFilterBadges(ds: CampaignDetail['voterDatasets'][0]) {
    const parts: string[] = []
    if (ds.filter_state_house) parts.push(`HD-${ds.filter_state_house}`)
    if (ds.filter_state_senate) parts.push(`SD-${ds.filter_state_senate}`)
    if (ds.filter_congressional) parts.push(`CD-${ds.filter_congressional}`)
    if (ds.filter_city) parts.push(ds.filter_city)
    if (ds.filter_zip) parts.push(`ZIP ${ds.filter_zip}`)
    return parts
  }

  async function handleAssign() {
    if (!selectedDataset) return
    setAssigning(true)
    const filters: Record<string, string | undefined> = {}
    if (showFilters) {
      if (filterHouse) filters.filterStateHouse = filterHouse
      if (filterSenate) filters.filterStateSenate = filterSenate
      if (filterCongressional) filters.filterCongressional = filterCongressional
      if (filterCity) filters.filterCity = filterCity
    }
    await fetch(`/api/platform/voter-datasets/${selectedDataset}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, ...filters }),
    })
    setSelectedDataset(''); setShowFilters(false)
    setFilterHouse(''); setFilterSenate(''); setFilterCongressional(''); setFilterCity('')
    setAssigning(false)
    onRefresh(campaignId)
  }

  async function handleUnassign(datasetId: string) {
    await fetch(`/api/platform/voter-datasets/${datasetId}/assign`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId }),
    })
    onRefresh(campaignId)
  }

  const ROLE_COLORS: Record<string, string> = {
    campaign_admin: 'bg-vc-purple/20 text-vc-purple-light border-vc-purple/30',
    org_owner: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    organizer: 'bg-vc-teal/20 text-vc-teal border-vc-teal/30',
    volunteer: 'bg-white/10 text-white/60 border-white/20',
    platform_admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  return (
    <div className="space-y-4">
      {/* Campaign Info */}
      <div className="flex items-start justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/40">
          <span className="font-mono">{campaignId}</span>
          <span>Slug: <span className="text-white/60 font-mono">{campaign.slug}</span></span>

          {/* Editable: State */}
          <span className="inline-flex items-center gap-1">
            State:{' '}
            {editing === 'state' ? (
              <span className="inline-flex items-center gap-1">
                <select
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  autoFocus
                  className="glass-input px-1.5 py-0.5 rounded text-white text-xs bg-transparent"
                >
                  {EDIT_STATES.map(s => <option key={s} value={s} className="bg-vc-surface">{s}</option>)}
                </select>
                <button onClick={saveEdit} disabled={saving} className="text-vc-teal hover:text-vc-teal/80"><Check className="w-3 h-3" /></button>
                <button onClick={() => setEditing(null)} className="text-white/30 hover:text-white/60"><X className="w-3 h-3" /></button>
              </span>
            ) : (
              <button onClick={() => startEdit('state')} className="inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors group">
                <span className="font-mono">{campaign.state}</span>
                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </span>

          {/* Editable: Election Date */}
          <span className="inline-flex items-center gap-1">
            Election:{' '}
            {editing === 'election_date' ? (
              <span className="inline-flex items-center gap-1">
                <input
                  type="date"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  autoFocus
                  className="glass-input px-1.5 py-0.5 rounded text-white text-xs bg-transparent"
                />
                <button onClick={saveEdit} disabled={saving} className="text-vc-teal hover:text-vc-teal/80"><Check className="w-3 h-3" /></button>
                <button onClick={() => setEditing(null)} className="text-white/30 hover:text-white/60"><X className="w-3 h-3" /></button>
              </span>
            ) : (
              <button onClick={() => startEdit('election_date')} className="inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors group">
                <span>{campaign.election_date ? new Date(campaign.election_date).toLocaleDateString() : '—'}</span>
                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </span>

          {/* Editable: Candidate Name */}
          <span className="inline-flex items-center gap-1">
            Candidate:{' '}
            {editing === 'candidate' ? (
              <span className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null) }}
                  className="glass-input px-1.5 py-0.5 rounded text-white text-xs w-36"
                  placeholder="Candidate name"
                />
                <button onClick={saveEdit} disabled={saving} className="text-vc-teal hover:text-vc-teal/80"><Check className="w-3 h-3" /></button>
                <button onClick={() => setEditing(null)} className="text-white/30 hover:text-white/60"><X className="w-3 h-3" /></button>
              </span>
            ) : (
              <button onClick={() => startEdit('candidate')} className="inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors group">
                <span>{campaign.candidate_name || '—'}</span>
                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </span>
        </div>
        <button
          onClick={() => onToggleActive(campaignId, campaign.is_active)}
          className={clsx(
            'px-3 py-1 rounded-btn text-xs font-medium transition-colors',
            campaign.is_active
              ? 'bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400'
              : 'bg-white/10 text-white/40 hover:bg-green-500/20 hover:text-green-400'
          )}
        >
          {campaign.is_active ? 'Active' : 'Inactive'}
        </button>
      </div>

      {/* Voter Datasets */}
      <div>
        <p className="text-xs text-white/40 mb-2">Voter Datasets ({detail.voterDatasets.length})</p>
        {detail.voterDatasets.length > 0 ? (
          <div className="space-y-1.5">
            {detail.voterDatasets.map(ds => {
              const badges = formatFilterBadges(ds)
              return (
                <div key={ds.dataset_id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-vc-purple/20 text-vc-purple-light border border-vc-purple/30 mr-2">
                  <Database className="w-3 h-3" />
                  {ds.dataset_name}
                  <span className="text-white/30">({ds.dataset_state} · {ds.record_count?.toLocaleString()})</span>
                  {badges.length > 0 && (
                    <span className="text-vc-teal/80 font-medium ml-1">[{badges.join(', ')}]</span>
                  )}
                  <button
                    onClick={() => handleUnassign(ds.dataset_id)}
                    className="ml-1 text-white/30 hover:text-red-400 transition-colors"
                    title="Unassign"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-white/30">No voter datasets assigned</p>
        )}

        {detail.availableDatasets.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={selectedDataset}
                onChange={e => setSelectedDataset(e.target.value)}
                className="glass-input px-3 py-1.5 rounded-btn text-white text-xs bg-transparent max-w-xs"
              >
                <option value="" className="bg-vc-surface">Assign dataset...</option>
                {detail.availableDatasets.map(d => (
                  <option key={d.id} value={d.id} className="bg-vc-surface">
                    {d.name} ({d.state} · {d.record_count?.toLocaleString()})
                  </option>
                ))}
              </select>
              {selectedDataset && (
                <>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={clsx(
                      'px-2.5 py-1.5 rounded-btn text-xs transition-colors',
                      showFilters ? 'bg-vc-purple/30 text-vc-purple-light' : 'text-white/40 hover:text-white/60'
                    )}
                  >
                    {showFilters ? 'Hide Filters' : 'Add Geo Filter'}
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={assigning}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-btn text-xs font-medium bg-vc-teal/80 text-white hover:bg-vc-teal transition-colors disabled:opacity-50"
                  >
                    {assigning ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3" />}
                    Assign
                  </button>
                </>
              )}
            </div>

            {showFilters && selectedDataset && geoOptions && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-1">
                {geoOptions.stateHouseDistricts.length > 0 && (
                  <div>
                    <label className="block text-[10px] text-white/40 mb-0.5">House District</label>
                    <select value={filterHouse} onChange={e => setFilterHouse(e.target.value)}
                      className="glass-input w-full px-2 py-1 rounded text-white text-xs bg-transparent">
                      <option value="" className="bg-vc-surface">All</option>
                      {geoOptions.stateHouseDistricts.map(d => (
                        <option key={d} value={d} className="bg-vc-surface">HD-{d}</option>
                      ))}
                    </select>
                  </div>
                )}
                {geoOptions.stateSenateDistricts.length > 0 && (
                  <div>
                    <label className="block text-[10px] text-white/40 mb-0.5">Senate District</label>
                    <select value={filterSenate} onChange={e => setFilterSenate(e.target.value)}
                      className="glass-input w-full px-2 py-1 rounded text-white text-xs bg-transparent">
                      <option value="" className="bg-vc-surface">All</option>
                      {geoOptions.stateSenateDistricts.map(d => (
                        <option key={d} value={d} className="bg-vc-surface">SD-{d}</option>
                      ))}
                    </select>
                  </div>
                )}
                {geoOptions.congressionalDistricts.length > 0 && (
                  <div>
                    <label className="block text-[10px] text-white/40 mb-0.5">Congressional</label>
                    <select value={filterCongressional} onChange={e => setFilterCongressional(e.target.value)}
                      className="glass-input w-full px-2 py-1 rounded text-white text-xs bg-transparent">
                      <option value="" className="bg-vc-surface">All</option>
                      {geoOptions.congressionalDistricts.map(d => (
                        <option key={d} value={d} className="bg-vc-surface">CD-{d}</option>
                      ))}
                    </select>
                  </div>
                )}
                {geoOptions.cities.length > 0 && (
                  <div>
                    <label className="block text-[10px] text-white/40 mb-0.5">City</label>
                    <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
                      className="glass-input w-full px-2 py-1 rounded text-white text-xs bg-transparent">
                      <option value="" className="bg-vc-surface">All</option>
                      {geoOptions.cities.slice(0, 200).map(c => (
                        <option key={c} value={c} className="bg-vc-surface">{c}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
            {showFilters && selectedDataset && !geoOptions && (
              <p className="text-[10px] text-white/30 pl-1">Loading geographic options...</p>
            )}
          </div>
        )}
      </div>

      {/* Members */}
      <div>
        <p className="text-xs text-white/40 mb-2">Members ({detail.members.length})</p>
        {detail.members.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {detail.members.map(m => (
              <div key={m.id} className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border',
                ROLE_COLORS[m.role] || ROLE_COLORS.volunteer
              )}>
                <Users className="w-3 h-3" />
                {m.user_name}
                <span className="text-white/30">({m.role})</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/30">No members yet — assign users in the Users tab</p>
        )}
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
  products: string[]
}

interface UserDetail {
  user: { id: string; email: string; name: string; phone: string | null; is_platform_admin: boolean; created_at: string }
  products: { product: string; granted_at: string; is_active: boolean }[]
  memberships: { id: string; role: string; is_active: boolean; campaign_name: string; campaign_id: string; org_name: string }[]
  textCampaignMemberships: { id: string; role: string; is_active: boolean; campaign_title: string; campaign_id: string; campaign_status: string }[]
  organizations: { id: string; name: string; slug: string }[]
}

interface AllCampaigns {
  relationalCampaigns: { id: string; name: string; slug: string; is_active: boolean; org_name: string }[]
  textingCampaigns: { id: string; title: string; status: string; org_name: string }[]
}

const PRODUCT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; Icon: typeof Users }> = {
  relational: { label: 'Relational', color: 'text-vc-purple-light', bg: 'bg-vc-purple/20', border: 'border-vc-purple/30', Icon: Users },
  events: { label: 'Events', color: 'text-vc-teal', bg: 'bg-vc-teal/20', border: 'border-vc-teal/30', Icon: Calendar },
  texting: { label: 'Texting', color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', Icon: MessageSquare },
}

function UsersTab() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailCache, setDetailCache] = useState<Record<string, UserDetail>>({})
  const [allCampaigns, setAllCampaigns] = useState<AllCampaigns | null>(null)

  // Create form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formProducts, setFormProducts] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const loadUsers = useCallback(() => {
    setLoading(true)
    fetch('/api/platform/users')
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  // Load all campaigns once for assignment dropdowns
  useEffect(() => {
    fetch('/api/platform/campaigns').then(r => r.json()).then(setAllCampaigns)
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      const res = await fetch('/api/platform/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim(),
          password: formPassword,
          phone: formPhone.trim() || undefined,
          products: formProducts,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create user')
        return
      }
      setFormName('')
      setFormEmail('')
      setFormPassword('')
      setFormPhone('')
      setFormProducts([])
      setShowCreate(false)
      loadUsers()
    } catch {
      setCreateError('Network error')
    } finally {
      setCreating(false)
    }
  }

  function toggleFormProduct(product: string) {
    setFormProducts(prev =>
      prev.includes(product) ? prev.filter(p => p !== product) : [...prev, product]
    )
  }

  async function loadDetail(userId: string) {
    if (detailCache[userId]) return
    const res = await fetch(`/api/platform/users/${userId}`)
    if (res.ok) {
      const data = await res.json()
      setDetailCache(prev => ({ ...prev, [userId]: data }))
    }
  }

  function toggleExpand(userId: string) {
    if (expandedId === userId) {
      setExpandedId(null)
    } else {
      setExpandedId(userId)
      loadDetail(userId)
    }
  }

  async function grantProduct(userId: string, product: string) {
    await fetch(`/api/platform/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grantProduct: product }),
    })
    // Refresh detail + user list
    const res = await fetch(`/api/platform/users/${userId}`)
    if (res.ok) {
      const data = await res.json()
      setDetailCache(prev => ({ ...prev, [userId]: data }))
    }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, products: [...new Set([...u.products, product])] } : u))
  }

  async function revokeProduct(userId: string, product: string) {
    await fetch(`/api/platform/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revokeProduct: product }),
    })
    const res = await fetch(`/api/platform/users/${userId}`)
    if (res.ok) {
      const data = await res.json()
      setDetailCache(prev => ({ ...prev, [userId]: data }))
    }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, products: u.products.filter(p => p !== product) } : u))
  }

  async function refreshDetail(userId: string) {
    const res = await fetch(`/api/platform/users/${userId}`)
    if (res.ok) {
      const data = await res.json()
      setDetailCache(prev => ({ ...prev, [userId]: data }))
    }
    loadUsers()
  }

  async function assignCampaign(userId: string, campaignId: string, role: string) {
    await fetch(`/api/platform/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignCampaign: { campaignId, role } }),
    })
    await refreshDetail(userId)
  }

  async function removeCampaign(userId: string, campaignId: string) {
    await fetch(`/api/platform/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeCampaign: { campaignId } }),
    })
    await refreshDetail(userId)
  }

  async function assignTextingCampaign(userId: string, campaignId: string, role: string) {
    await fetch(`/api/platform/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignTextingCampaign: { campaignId, role } }),
    })
    await refreshDetail(userId)
  }

  async function removeTextingCampaign(userId: string, campaignId: string) {
    await fetch(`/api/platform/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeTextingCampaign: { campaignId } }),
    })
    await refreshDetail(userId)
  }

  async function renameOrganization(userId: string, orgId: string, name: string) {
    await fetch(`/api/platform/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ renameOrganization: { orgId, name } }),
    })
    await refreshDetail(userId)
  }

  async function renameCampaign(campaignId: string, name: string, type: 'relational' | 'texting') {
    await fetch('/api/platform/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: campaignId, name, type: type === 'texting' ? 'texting' : undefined }),
    })
    // Refresh the campaigns list + user detail
    const campRes = await fetch('/api/platform/campaigns')
    if (campRes.ok) setAllCampaigns(await campRes.json())
  }

  if (loading) return <LoadingState />

  const filtered = search
    ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    : users

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
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
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium bg-vc-purple text-white hover:bg-vc-purple-light transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Create User
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="glass-card p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">Name *</label>
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm"
                placeholder="Jane Smith"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Email *</label>
              <input
                type="email"
                value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm"
                placeholder="jane@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Password *</label>
              <input
                type="password"
                value={formPassword}
                onChange={e => setFormPassword(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm"
                placeholder="8+ characters"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Phone</label>
              <input
                type="tel"
                value={formPhone}
                onChange={e => setFormPhone(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm"
                placeholder="(555) 555-1234"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-2">Product Access</label>
            <div className="flex gap-2">
              {Object.entries(PRODUCT_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleFormProduct(key)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-medium border transition-colors',
                    formProducts.includes(key)
                      ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                      : 'bg-white/5 text-white/30 border-white/10 hover:bg-white/10'
                  )}
                >
                  <cfg.Icon className="w-3.5 h-3.5" />
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
          {createError && (
            <p className="text-red-400 text-xs">{createError}</p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-btn text-sm font-medium bg-vc-teal text-white hover:bg-vc-teal/80 transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-btn text-sm text-white/50 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="w-8 px-2 py-3" />
                <th className="text-left px-4 py-3 text-white/50 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Products</th>
                <th className="text-center px-4 py-3 text-white/50 font-medium">Admin</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <React.Fragment key={u.id}>
                  <tr
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => toggleExpand(u.id)}
                  >
                    <td className="px-2 py-3 text-white/30">
                      {expandedId === u.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-white/60 text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {u.products.length > 0 ? u.products.map(p => {
                          const cfg = PRODUCT_CONFIG[p]
                          return cfg ? (
                            <span key={p} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                              <cfg.Icon className="w-2.5 h-2.5" />
                              {cfg.label}
                            </span>
                          ) : null
                        }) : (
                          <span className="text-white/20 text-xs">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={e => { e.stopPropagation(); toggleAdmin(u.id, u.is_platform_admin) }}
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
                    <td className="px-4 py-3 text-white/50 text-xs">{formatDate(u.created_at)}</td>
                  </tr>
                  {expandedId === u.id && (
                    <tr key={`${u.id}-detail`} className="border-b border-white/5 bg-white/[0.02]">
                      <td colSpan={6} className="px-6 py-4">
                        <UserExpandedRow
                          userId={u.id}
                          detail={detailCache[u.id]}
                          allCampaigns={allCampaigns}
                          onGrant={grantProduct}
                          onRevoke={revokeProduct}
                          onAssignCampaign={assignCampaign}
                          onRemoveCampaign={removeCampaign}
                          onAssignTextingCampaign={assignTextingCampaign}
                          onRemoveTextingCampaign={removeTextingCampaign}
                          onRenameOrganization={renameOrganization}
                          onRenameCampaign={async (cId, name, type) => { await renameCampaign(cId, name, type); await refreshDetail(u.id) }}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-white/30">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function UserExpandedRow({
  userId,
  detail,
  allCampaigns,
  onGrant,
  onRevoke,
  onAssignCampaign,
  onRemoveCampaign,
  onAssignTextingCampaign,
  onRemoveTextingCampaign,
  onRenameOrganization,
  onRenameCampaign,
}: {
  userId: string
  detail?: UserDetail
  allCampaigns: AllCampaigns | null
  onGrant: (userId: string, product: string) => void
  onRevoke: (userId: string, product: string) => void
  onAssignCampaign: (userId: string, campaignId: string, role: string) => Promise<void>
  onRemoveCampaign: (userId: string, campaignId: string) => Promise<void>
  onAssignTextingCampaign: (userId: string, campaignId: string, role: string) => Promise<void>
  onRemoveTextingCampaign: (userId: string, campaignId: string) => Promise<void>
  onRenameOrganization: (userId: string, orgId: string, name: string) => Promise<void>
  onRenameCampaign: (campaignId: string, name: string, type: 'relational' | 'texting') => Promise<void>
}) {
  const [granting, setGranting] = useState<string | null>(null)
  const [assigningRelational, setAssigningRelational] = useState(false)
  const [assigningTexting, setAssigningTexting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [selectedRelCampaign, setSelectedRelCampaign] = useState('')
  const [selectedRelRole, setSelectedRelRole] = useState('volunteer')
  const [selectedTextCampaign, setSelectedTextCampaign] = useState('')
  const [selectedTextRole, setSelectedTextRole] = useState('texter')
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null)
  const [orgNameInput, setOrgNameInput] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [campaignNameInput, setCampaignNameInput] = useState('')
  const [savingCampaign, setSavingCampaign] = useState(false)

  if (!detail) return <LoadingState />

  const activeProducts = new Set(detail.products.filter(p => p.is_active).map(p => p.product))
  const activeMembershipIds = new Set(detail.memberships.filter(m => m.is_active).map(m => m.campaign_id))
  const activeTextMemberIds = new Set(detail.textCampaignMemberships.filter(m => m.is_active).map(m => m.campaign_id))

  return (
    <div className="space-y-4">
      {/* Product access toggles */}
      <div>
        <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wider">Product Access</p>
        <div className="flex gap-2">
          {Object.entries(PRODUCT_CONFIG).map(([key, cfg]) => {
            const hasAccess = activeProducts.has(key)
            return (
              <button
                key={key}
                onClick={async () => {
                  setGranting(key)
                  if (hasAccess) {
                    await onRevoke(userId, key)
                  } else {
                    await onGrant(userId, key)
                  }
                  setGranting(null)
                }}
                disabled={granting === key}
                className={clsx(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-medium border transition-colors',
                  hasAccess
                    ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                    : 'bg-white/5 text-white/30 border-white/10 hover:bg-white/10',
                  granting === key && 'opacity-50'
                )}
              >
                {granting === key ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <cfg.Icon className="w-3.5 h-3.5" />
                )}
                {cfg.label}
                {hasAccess && <Check className="w-3 h-3 ml-0.5" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Relational campaigns */}
      <div>
        <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wider">Relational Campaigns</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {detail.memberships.filter(m => m.is_active).map(m => (
            <span key={m.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-vc-purple/20 text-vc-purple-light border-vc-purple/30">
              <Users className="w-3 h-3" />
              {editingCampaignId === m.campaign_id ? (
                <form
                  className="inline-flex items-center gap-1"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!campaignNameInput.trim()) return
                    setSavingCampaign(true)
                    await onRenameCampaign(m.campaign_id, campaignNameInput, 'relational')
                    setEditingCampaignId(null)
                    setSavingCampaign(false)
                  }}
                >
                  <input
                    value={campaignNameInput}
                    onChange={e => setCampaignNameInput(e.target.value)}
                    className="glass-input px-1.5 py-0.5 rounded text-xs text-white w-32"
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                  <button type="submit" disabled={savingCampaign} className="text-vc-teal hover:text-vc-teal/80">
                    {savingCampaign ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  </button>
                  <button type="button" onClick={() => setEditingCampaignId(null)} className="text-white/30 hover:text-white/60">
                    <X className="w-3 h-3" />
                  </button>
                </form>
              ) : (
                <span
                  className="cursor-pointer hover:text-white transition-colors"
                  onClick={() => { setEditingCampaignId(m.campaign_id); setCampaignNameInput(m.campaign_name) }}
                  title="Click to rename campaign"
                >
                  {m.campaign_name}
                </span>
              )}
              <span className="text-white/30">({m.role})</span>
              <button
                onClick={async () => {
                  setRemovingId(m.campaign_id)
                  await onRemoveCampaign(userId, m.campaign_id)
                  setRemovingId(null)
                }}
                disabled={removingId === m.campaign_id}
                className="ml-0.5 text-white/30 hover:text-red-400 transition-colors"
                title="Remove from campaign"
              >
                {removingId === m.campaign_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              </button>
            </span>
          ))}
          {detail.memberships.filter(m => m.is_active).length === 0 && (
            <span className="text-xs text-white/20">No relational campaigns</span>
          )}
        </div>
        {allCampaigns && allCampaigns.relationalCampaigns.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={selectedRelCampaign}
              onChange={e => setSelectedRelCampaign(e.target.value)}
              className="glass-input px-2 py-1.5 rounded-btn text-xs text-white min-w-[180px]"
            >
              <option value="">Assign to campaign...</option>
              {allCampaigns.relationalCampaigns
                .filter(c => !activeMembershipIds.has(c.id))
                .map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.org_name})</option>
                ))}
            </select>
            <select
              value={selectedRelRole}
              onChange={e => setSelectedRelRole(e.target.value)}
              className="glass-input px-2 py-1.5 rounded-btn text-xs text-white"
            >
              <option value="volunteer">Volunteer</option>
              <option value="organizer">Organizer</option>
              <option value="campaign_admin">Admin</option>
            </select>
            <button
              onClick={async () => {
                if (!selectedRelCampaign) return
                setAssigningRelational(true)
                await onAssignCampaign(userId, selectedRelCampaign, selectedRelRole)
                setSelectedRelCampaign('')
                setAssigningRelational(false)
              }}
              disabled={!selectedRelCampaign || assigningRelational}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-btn text-xs font-medium bg-vc-purple/30 text-vc-purple-light border border-vc-purple/30 hover:bg-vc-purple/40 transition-colors disabled:opacity-30"
            >
              {assigningRelational ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Assign
            </button>
          </div>
        )}
      </div>

      {/* Texting campaigns */}
      <div>
        <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wider">Texting Campaigns</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {detail.textCampaignMemberships.filter(m => m.is_active).map(m => (
            <span key={m.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-amber-500/20 text-amber-400 border-amber-500/30">
              <MessageSquare className="w-3 h-3" />
              {editingCampaignId === `text-${m.campaign_id}` ? (
                <form
                  className="inline-flex items-center gap-1"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!campaignNameInput.trim()) return
                    setSavingCampaign(true)
                    await onRenameCampaign(m.campaign_id, campaignNameInput, 'texting')
                    setEditingCampaignId(null)
                    setSavingCampaign(false)
                  }}
                >
                  <input
                    value={campaignNameInput}
                    onChange={e => setCampaignNameInput(e.target.value)}
                    className="glass-input px-1.5 py-0.5 rounded text-xs text-white w-32"
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                  <button type="submit" disabled={savingCampaign} className="text-vc-teal hover:text-vc-teal/80">
                    {savingCampaign ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  </button>
                  <button type="button" onClick={() => setEditingCampaignId(null)} className="text-white/30 hover:text-white/60">
                    <X className="w-3 h-3" />
                  </button>
                </form>
              ) : (
                <span
                  className="cursor-pointer hover:text-white transition-colors"
                  onClick={() => { setEditingCampaignId(`text-${m.campaign_id}`); setCampaignNameInput(m.campaign_title) }}
                  title="Click to rename campaign"
                >
                  {m.campaign_title}
                </span>
              )}
              <span className="text-white/30">({m.role})</span>
              <button
                onClick={async () => {
                  setRemovingId(`text-${m.campaign_id}`)
                  await onRemoveTextingCampaign(userId, m.campaign_id)
                  setRemovingId(null)
                }}
                disabled={removingId === `text-${m.campaign_id}`}
                className="ml-0.5 text-white/30 hover:text-red-400 transition-colors"
                title="Remove from campaign"
              >
                {removingId === `text-${m.campaign_id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              </button>
            </span>
          ))}
          {detail.textCampaignMemberships.filter(m => m.is_active).length === 0 && (
            <span className="text-xs text-white/20">No texting campaigns</span>
          )}
        </div>
        {allCampaigns && allCampaigns.textingCampaigns.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={selectedTextCampaign}
              onChange={e => setSelectedTextCampaign(e.target.value)}
              className="glass-input px-2 py-1.5 rounded-btn text-xs text-white min-w-[180px]"
            >
              <option value="">Assign to campaign...</option>
              {allCampaigns.textingCampaigns
                .filter(c => !activeTextMemberIds.has(c.id))
                .map(c => (
                  <option key={c.id} value={c.id}>{c.title} ({c.org_name})</option>
                ))}
            </select>
            <select
              value={selectedTextRole}
              onChange={e => setSelectedTextRole(e.target.value)}
              className="glass-input px-2 py-1.5 rounded-btn text-xs text-white"
            >
              <option value="texter">Texter</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={async () => {
                if (!selectedTextCampaign) return
                setAssigningTexting(true)
                await onAssignTextingCampaign(userId, selectedTextCampaign, selectedTextRole)
                setSelectedTextCampaign('')
                setAssigningTexting(false)
              }}
              disabled={!selectedTextCampaign || assigningTexting}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-btn text-xs font-medium bg-amber-500/30 text-amber-400 border border-amber-500/30 hover:bg-amber-500/40 transition-colors disabled:opacity-30"
            >
              {assigningTexting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Assign
            </button>
          </div>
        )}
      </div>

      {/* Organizations */}
      {detail.organizations && detail.organizations.length > 0 && (
        <div>
          <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wider">Organizations</p>
          <div className="flex flex-wrap gap-2">
            {detail.organizations.map(org => (
              <span key={org.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-white/5 text-white/60 border-white/10">
                <Building2 className="w-3 h-3" />
                {editingOrgId === org.id ? (
                  <form
                    className="inline-flex items-center gap-1"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!orgNameInput.trim()) return
                      setSavingOrg(true)
                      await onRenameOrganization(userId, org.id, orgNameInput)
                      setEditingOrgId(null)
                      setSavingOrg(false)
                    }}
                  >
                    <input
                      value={orgNameInput}
                      onChange={e => setOrgNameInput(e.target.value)}
                      className="glass-input px-1.5 py-0.5 rounded text-xs text-white w-32"
                      autoFocus
                    />
                    <button type="submit" disabled={savingOrg} className="text-vc-teal hover:text-vc-teal/80">
                      {savingOrg ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    </button>
                    <button type="button" onClick={() => setEditingOrgId(null)} className="text-white/30 hover:text-white/60">
                      <X className="w-3 h-3" />
                    </button>
                  </form>
                ) : (
                  <>
                    {org.name}
                    <span className="text-white/20">/{org.slug}</span>
                    <button
                      onClick={() => { setEditingOrgId(org.id); setOrgNameInput(org.name) }}
                      className="text-white/20 hover:text-white/50 transition-colors"
                      title="Rename organization"
                    >
                      ✎
                    </button>
                  </>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* User details */}
      <div className="flex gap-6 text-xs text-white/40">
        {detail.user.phone && <span>Phone: {detail.user.phone}</span>}
        <span>Created: {formatDate(detail.user.created_at)}</span>
        <span>ID: <span className="font-mono text-white/20">{detail.user.id.slice(0, 8)}...</span></span>
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

// ========== VOTER DATA ==========

interface VoterDataset {
  id: string
  name: string
  state: string
  geography_type: string
  geography_name: string | null
  record_count: number
  status: string
  error_message: string | null
  created_at: string
  campaign_count: number
}

interface Campaign {
  id: string
  name: string
  slug: string
  org_name: string
  filter_congressional?: string | null
  filter_state_senate?: string | null
  filter_state_house?: string | null
  filter_city?: string | null
  filter_zip?: string | null
}

interface GeoOptions {
  congressionalDistricts: string[]
  stateSenateDistricts: string[]
  stateHouseDistricts: string[]
  cities: string[]
  zips: string[]
}

interface DatasetDetail {
  dataset: VoterDataset
  cities: string[]
  assignedCampaigns: Campaign[]
  geoOptions?: GeoOptions
}

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

function VoterDataTab() {
  const [datasets, setDatasets] = useState<VoterDataset[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailCache, setDetailCache] = useState<Record<string, DatasetDetail>>({})
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formState, setFormState] = useState('')
  const [formGeoType, setFormGeoType] = useState('state')
  const [formGeoName, setFormGeoName] = useState('')
  const [formFile, setFormFile] = useState<File | null>(null)

  const loadDatasets = useCallback(() => {
    setLoading(true)
    fetch('/api/platform/voter-datasets')
      .then(r => r.json())
      .then(d => setDatasets(d.datasets || []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadDatasets() }, [loadDatasets])

  // Load all campaigns for assignment dropdown
  useEffect(() => {
    fetch('/api/platform/campaigns')
      .then(r => r.json())
      .then(d => setAllCampaigns(d.relationalCampaigns || []))
  }, [])

  async function loadDetail(datasetId: string) {
    if (detailCache[datasetId]) return
    const res = await fetch(`/api/platform/voter-datasets/${datasetId}`)
    if (res.ok) {
      const data = await res.json()
      setDetailCache(prev => ({ ...prev, [datasetId]: data }))
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim() || !formState || !formFile) return
    setUploading(true)
    setUploadProgress('Uploading...')

    const fd = new FormData()
    fd.append('name', formName.trim())
    fd.append('state', formState)
    fd.append('geographyType', formGeoType)
    if (formGeoName.trim()) fd.append('geographyName', formGeoName.trim())
    fd.append('file', formFile)

    try {
      const res = await fetch('/api/platform/voter-datasets', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setUploadProgress(`Done! ${data.recordCount?.toLocaleString()} records imported.`)
        setFormName('')
        setFormGeoName('')
        setFormFile(null)
        setShowForm(false)
        loadDatasets()
      } else {
        setUploadProgress(`Error: ${data.error}`)
      }
    } catch (err) {
      setUploadProgress(`Upload failed: ${err}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(datasetId: string) {
    if (!confirm('Delete this voter dataset and all its records? This cannot be undone.')) return
    setDeleting(datasetId)
    await fetch(`/api/platform/voter-datasets/${datasetId}`, { method: 'DELETE' })
    setDeleting(null)
    loadDatasets()
  }

  async function handleAssign(datasetId: string, campaignId: string, filters?: {
    filterCongressional?: string
    filterStateSenate?: string
    filterStateHouse?: string
    filterCity?: string
    filterZip?: string
  }) {
    await fetch(`/api/platform/voter-datasets/${datasetId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, ...filters }),
    })
    // Refresh detail
    const res = await fetch(`/api/platform/voter-datasets/${datasetId}`)
    if (res.ok) {
      const data = await res.json()
      setDetailCache(prev => ({ ...prev, [datasetId]: data }))
    }
  }

  async function handleUnassign(datasetId: string, campaignId: string) {
    await fetch(`/api/platform/voter-datasets/${datasetId}/assign`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId }),
    })
    const res = await fetch(`/api/platform/voter-datasets/${datasetId}`)
    if (res.ok) {
      const data = await res.json()
      setDetailCache(prev => ({ ...prev, [datasetId]: data }))
    }
  }

  function toggleExpand(datasetId: string) {
    if (expandedId === datasetId) {
      setExpandedId(null)
    } else {
      setExpandedId(datasetId)
      loadDetail(datasetId)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-sm">{datasets.length} dataset{datasets.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium bg-vc-purple text-white hover:bg-vc-purple-light transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload Dataset
        </button>
      </div>

      <p className="text-xs text-white/30">
        Web upload supports files up to 100MB. For larger statewide voter files, use the CLI:{' '}
        <code className="text-white/50 bg-white/5 px-1.5 py-0.5 rounded text-[10px]">npm run import:voters -- --file=data/voters.json --name=&quot;Name&quot; --state=PA</code>
      </p>

      {showForm && (
        <form onSubmit={handleUpload} className="glass-card p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">Dataset Name</label>
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm"
                placeholder="e.g. PA House District 91"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">State</label>
              <select
                value={formState}
                onChange={e => setFormState(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm bg-transparent"
                required
              >
                <option value="" disabled className="bg-vc-surface">Select state...</option>
                {US_STATES.map(s => <option key={s} value={s} className="bg-vc-surface">{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Geography Type</label>
              <select
                value={formGeoType}
                onChange={e => setFormGeoType(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm bg-transparent"
              >
                <option value="state" className="bg-vc-surface">State</option>
                <option value="county" className="bg-vc-surface">County</option>
                <option value="district" className="bg-vc-surface">District</option>
                <option value="city" className="bg-vc-surface">City</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Geography Name</label>
              <input
                value={formGeoName}
                onChange={e => setFormGeoName(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm"
                placeholder="e.g. HD-91"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Voter File (JSON)</label>
            <input
              type="file"
              accept=".json"
              onChange={e => setFormFile(e.target.files?.[0] || null)}
              className="glass-input w-full px-3 py-2 rounded-btn text-white text-sm file:mr-3 file:px-3 file:py-1 file:rounded-btn file:border-0 file:bg-vc-purple/30 file:text-white/70 file:text-xs"
              required
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={uploading || !formFile || !formState}
              className="px-4 py-2 rounded-btn text-sm font-medium bg-vc-teal text-white hover:bg-vc-teal/80 transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload & Import'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-btn text-sm text-white/50 hover:text-white transition-colors"
            >
              Cancel
            </button>
            {uploadProgress && (
              <span className="text-xs text-white/40">{uploadProgress}</span>
            )}
          </div>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="w-8 px-2 py-3" />
                <th className="text-left px-4 py-3 text-white/50 font-medium">Name</th>
                <th className="text-center px-4 py-3 text-white/50 font-medium">State</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Geography</th>
                <th className="text-right px-4 py-3 text-white/50 font-medium">Records</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Status</th>
                <th className="text-center px-4 py-3 text-white/50 font-medium">Campaigns</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Created</th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {datasets.map(ds => (
                <React.Fragment key={ds.id}>
                  <tr
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => toggleExpand(ds.id)}
                  >
                    <td className="px-2 py-3 text-white/30">
                      {expandedId === ds.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{ds.name}</td>
                    <td className="px-4 py-3 text-center text-white/70 font-mono text-xs">{ds.state}</td>
                    <td className="px-4 py-3 text-white/60 text-xs">
                      <span className="capitalize">{ds.geography_type}</span>
                      {ds.geography_name && <span className="text-white/40"> &middot; {ds.geography_name}</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-white/70 font-mono">{ds.record_count.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={ds.status} label={ds.status} />
                    </td>
                    <td className="px-4 py-3 text-center text-white/70">{ds.campaign_count}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">{formatDate(ds.created_at)}</td>
                    <td className="px-2 py-3">
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(ds.id) }}
                        disabled={deleting === ds.id}
                        className="p-1 text-white/20 hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Delete dataset"
                      >
                        {deleting === ds.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                  {expandedId === ds.id && (
                    <tr key={`${ds.id}-detail`} className="border-b border-white/5 bg-white/[0.02]">
                      <td colSpan={9} className="px-6 py-4">
                        <DatasetExpandedRow
                          datasetId={ds.id}
                          detail={detailCache[ds.id]}
                          allCampaigns={allCampaigns}
                          onAssign={handleAssign}
                          onUnassign={handleUnassign}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {datasets.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-white/30">No voter datasets uploaded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function DatasetExpandedRow({
  datasetId,
  detail,
  allCampaigns,
  onAssign,
  onUnassign,
}: {
  datasetId: string
  detail?: DatasetDetail
  allCampaigns: Campaign[]
  onAssign: (datasetId: string, campaignId: string, filters?: {
    filterCongressional?: string
    filterStateSenate?: string
    filterStateHouse?: string
    filterCity?: string
    filterZip?: string
  }) => void
  onUnassign: (datasetId: string, campaignId: string) => void
}) {
  const [assigning, setAssigning] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filterHouse, setFilterHouse] = useState('')
  const [filterSenate, setFilterSenate] = useState('')
  const [filterCongressional, setFilterCongressional] = useState('')
  const [filterCity, setFilterCity] = useState('')

  if (!detail) return <LoadingState />

  const assignedIds = new Set(detail.assignedCampaigns.map(c => c.id))
  const unassignedCampaigns = allCampaigns.filter(c => !assignedIds.has(c.id))
  const geo = detail.geoOptions

  function formatFilters(c: Campaign): string | null {
    const parts: string[] = []
    if (c.filter_state_house) parts.push(`HD-${c.filter_state_house}`)
    if (c.filter_state_senate) parts.push(`SD-${c.filter_state_senate}`)
    if (c.filter_congressional) parts.push(`CD-${c.filter_congressional}`)
    if (c.filter_city) parts.push(c.filter_city)
    if (c.filter_zip) parts.push(`ZIP ${c.filter_zip}`)
    return parts.length > 0 ? parts.join(', ') : null
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-8">
        <div>
          <p className="text-xs text-white/40 mb-1">Cities ({detail.cities.length})</p>
          <p className="text-xs text-white/60 max-w-md">
            {detail.cities.length > 0
              ? detail.cities.slice(0, 15).join(', ') + (detail.cities.length > 15 ? ` +${detail.cities.length - 15} more` : '')
              : 'No city data'}
          </p>
        </div>
        {geo && (
          <div>
            <p className="text-xs text-white/40 mb-1">Districts</p>
            <p className="text-xs text-white/60">
              {geo.stateHouseDistricts.length > 0 && `${geo.stateHouseDistricts.length} House`}
              {geo.stateSenateDistricts.length > 0 && ` · ${geo.stateSenateDistricts.length} Senate`}
              {geo.congressionalDistricts.length > 0 && ` · ${geo.congressionalDistricts.length} Congressional`}
            </p>
          </div>
        )}
        {detail.dataset.error_message && (
          <div>
            <p className="text-xs text-red-400/80 mb-1">Error</p>
            <p className="text-xs text-red-400/60">{detail.dataset.error_message}</p>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs text-white/40 mb-2">Assigned Campaigns</p>
        {detail.assignedCampaigns.length > 0 ? (
          <div className="space-y-1.5">
            {detail.assignedCampaigns.map(c => {
              const filterStr = formatFilters(c)
              return (
                <div key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-vc-purple/20 text-vc-purple-light border border-vc-purple/30 mr-2">
                  <LinkIcon className="w-3 h-3" />
                  {c.name}
                  <span className="text-white/30">({c.org_name})</span>
                  {filterStr && (
                    <span className="text-vc-teal/80 font-medium ml-1">[{filterStr}]</span>
                  )}
                  <button
                    onClick={() => onUnassign(datasetId, c.id)}
                    className="ml-1 text-white/30 hover:text-red-400 transition-colors"
                    title="Unassign"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-white/30">No campaigns assigned</p>
        )}
      </div>

      {unassignedCampaigns.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <select
              id={`assign-${datasetId}`}
              className="glass-input px-3 py-1.5 rounded-btn text-white text-xs bg-transparent max-w-xs"
              defaultValue=""
            >
              <option value="" disabled className="bg-vc-surface">Assign to campaign...</option>
              {unassignedCampaigns.map(c => (
                <option key={c.id} value={c.id} className="bg-vc-surface">{c.name} ({c.org_name})</option>
              ))}
            </select>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                'px-2.5 py-1.5 rounded-btn text-xs transition-colors',
                showFilters ? 'bg-vc-purple/30 text-vc-purple-light' : 'text-white/40 hover:text-white/60'
              )}
            >
              {showFilters ? 'Hide Filters' : 'Add Geo Filter'}
            </button>
            <button
              onClick={async () => {
                const sel = document.getElementById(`assign-${datasetId}`) as HTMLSelectElement
                if (!sel?.value) return
                setAssigning(true)
                const filters = showFilters ? {
                  filterStateHouse: filterHouse || undefined,
                  filterStateSenate: filterSenate || undefined,
                  filterCongressional: filterCongressional || undefined,
                  filterCity: filterCity || undefined,
                } : undefined
                await onAssign(datasetId, sel.value, filters)
                sel.value = ''
                setFilterHouse('')
                setFilterSenate('')
                setFilterCongressional('')
                setFilterCity('')
                setAssigning(false)
              }}
              disabled={assigning}
              className="flex items-center gap-1 px-3 py-1.5 rounded-btn text-xs font-medium bg-vc-teal/80 text-white hover:bg-vc-teal transition-colors disabled:opacity-50"
            >
              {assigning ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3" />}
              Assign
            </button>
          </div>

          {showFilters && geo && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-1">
              {geo.stateHouseDistricts.length > 0 && (
                <div>
                  <label className="block text-[10px] text-white/40 mb-0.5">House District</label>
                  <select
                    value={filterHouse}
                    onChange={e => setFilterHouse(e.target.value)}
                    className="glass-input w-full px-2 py-1 rounded text-white text-xs bg-transparent"
                  >
                    <option value="" className="bg-vc-surface">All</option>
                    {geo.stateHouseDistricts.map(d => (
                      <option key={d} value={d} className="bg-vc-surface">HD-{d}</option>
                    ))}
                  </select>
                </div>
              )}
              {geo.stateSenateDistricts.length > 0 && (
                <div>
                  <label className="block text-[10px] text-white/40 mb-0.5">Senate District</label>
                  <select
                    value={filterSenate}
                    onChange={e => setFilterSenate(e.target.value)}
                    className="glass-input w-full px-2 py-1 rounded text-white text-xs bg-transparent"
                  >
                    <option value="" className="bg-vc-surface">All</option>
                    {geo.stateSenateDistricts.map(d => (
                      <option key={d} value={d} className="bg-vc-surface">SD-{d}</option>
                    ))}
                  </select>
                </div>
              )}
              {geo.congressionalDistricts.length > 0 && (
                <div>
                  <label className="block text-[10px] text-white/40 mb-0.5">Congressional</label>
                  <select
                    value={filterCongressional}
                    onChange={e => setFilterCongressional(e.target.value)}
                    className="glass-input w-full px-2 py-1 rounded text-white text-xs bg-transparent"
                  >
                    <option value="" className="bg-vc-surface">All</option>
                    {geo.congressionalDistricts.map(d => (
                      <option key={d} value={d} className="bg-vc-surface">CD-{d}</option>
                    ))}
                  </select>
                </div>
              )}
              {geo.cities.length > 0 && (
                <div>
                  <label className="block text-[10px] text-white/40 mb-0.5">City</label>
                  <select
                    value={filterCity}
                    onChange={e => setFilterCity(e.target.value)}
                    className="glass-input w-full px-2 py-1 rounded text-white text-xs bg-transparent"
                  >
                    <option value="" className="bg-vc-surface">All</option>
                    {geo.cities.slice(0, 200).map(c => (
                      <option key={c} value={c} className="bg-vc-surface">{c}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          {showFilters && !geo && (
            <p className="text-[10px] text-white/30 pl-1">Loading geographic options...</p>
          )}
        </div>
      )}
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
    ready: 'bg-vc-teal/20 text-vc-teal border-vc-teal/30',
    processing: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
    trialing: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
    error: 'bg-red-400/20 text-red-400 border-red-400/30',
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

// ========== SETTINGS ==========

interface AISettingsData {
  provider: 'anthropic' | 'gemini'
  chatModel: string
  suggestModel: string
  maxTokens: number
  rateLimitMessages: number
  rateLimitWindowMinutes: number
  suggestRateLimit: number
}

interface ModelOption {
  id: string
  label: string
  cost: string
}

interface SettingsResponse {
  settings: AISettingsData
  modelOptions: {
    anthropic: { chat: ModelOption[]; suggest: ModelOption[] }
    gemini: { chat: ModelOption[]; suggest: ModelOption[] }
  }
  apiKeysConfigured: { anthropic: boolean; gemini: boolean }
}

function SettingsTab() {
  const [data, setData] = useState<SettingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<AISettingsData | null>(null)

  useEffect(() => {
    fetch('/api/platform/settings').then(r => r.json()).then((d: SettingsResponse) => {
      setData(d)
      setForm(d.settings)
      setLoading(false)
    })
  }, [])

  const save = async () => {
    if (!form) return
    setSaving(true)
    setSaved(false)
    const res = await fetch('/api/platform/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const d = await res.json()
      setForm(d.settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (loading || !data || !form) return <LoadingState />

  const { modelOptions, apiKeysConfigured } = data
  const chatModels = modelOptions[form.provider]?.chat || []
  const suggestModels = modelOptions[form.provider]?.suggest || []

  // Cost estimator: 500 volunteers, ~20 messages/day, ~2K tokens input + 500 output per message
  const selectedChatModel = chatModels.find(m => m.id === form.chatModel)
  const selectedSuggestModel = suggestModels.find(m => m.id === form.suggestModel)

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-white mb-4">AI Provider</h3>
        <p className="text-white/50 text-sm mb-4">Choose which AI service powers the volunteer coaching chat and event suggestions.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['anthropic', 'gemini'] as const).map(provider => (
            <button
              key={provider}
              onClick={() => {
                const defaults = provider === 'anthropic'
                  ? { chatModel: 'claude-sonnet-4-6', suggestModel: 'claude-haiku-4-5-20251001' }
                  : { chatModel: 'gemini-3-flash-preview', suggestModel: 'gemini-3-flash-preview' }
                setForm({ ...form, provider, ...defaults })
              }}
              className={clsx(
                'p-4 rounded-lg border-2 text-left transition-all',
                form.provider === provider
                  ? 'border-vc-purple bg-vc-purple/20 shadow-glow'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg font-bold text-white">
                  {provider === 'anthropic' ? 'Anthropic (Claude)' : 'Google (Gemini)'}
                </span>
                {form.provider === provider && <Check className="w-5 h-5 text-vc-purple-light" />}
              </div>
              <div className="text-xs text-white/40">
                {apiKeysConfigured[provider]
                  ? <span className="text-vc-teal">API key configured</span>
                  : <span className="text-red-400">No API key — set {provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY'} in environment</span>
                }
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Model Selection */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-white mb-4">Models</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chat model */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Chat Model (volunteer coaching)</label>
            <select
              value={form.chatModel}
              onChange={e => setForm({ ...form, chatModel: e.target.value })}
              className="w-full bg-white/10 text-white border border-white/20 rounded-btn px-3 py-2 text-sm focus:border-vc-purple focus:outline-none"
            >
              {chatModels.map(m => (
                <option key={m.id} value={m.id} className="bg-[#1a1a2e]">{m.label}</option>
              ))}
            </select>
            {selectedChatModel && (
              <p className="text-xs text-white/40 mt-1">{selectedChatModel.cost}</p>
            )}
          </div>

          {/* Suggest model */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Suggest Model (event descriptions)</label>
            <select
              value={form.suggestModel}
              onChange={e => setForm({ ...form, suggestModel: e.target.value })}
              className="w-full bg-white/10 text-white border border-white/20 rounded-btn px-3 py-2 text-sm focus:border-vc-purple focus:outline-none"
            >
              {suggestModels.map(m => (
                <option key={m.id} value={m.id} className="bg-[#1a1a2e]">{m.label}</option>
              ))}
            </select>
            {selectedSuggestModel && (
              <p className="text-xs text-white/40 mt-1">{selectedSuggestModel.cost}</p>
            )}
          </div>
        </div>
      </div>

      {/* Token & Rate Limits */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-white mb-4">Limits</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Max Tokens (chat response length)</label>
            <input
              type="number" min={256} max={8192} step={256}
              value={form.maxTokens}
              onChange={e => setForm({ ...form, maxTokens: parseInt(e.target.value) || 1024 })}
              className="w-full bg-white/10 text-white border border-white/20 rounded-btn px-3 py-2 text-sm focus:border-vc-purple focus:outline-none"
            />
            <p className="text-xs text-white/30 mt-1">256–8192</p>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1.5">Chat rate limit (msgs)</label>
            <input
              type="number" min={5} max={500}
              value={form.rateLimitMessages}
              onChange={e => setForm({ ...form, rateLimitMessages: parseInt(e.target.value) || 60 })}
              className="w-full bg-white/10 text-white border border-white/20 rounded-btn px-3 py-2 text-sm focus:border-vc-purple focus:outline-none"
            />
            <p className="text-xs text-white/30 mt-1">Per user per window</p>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1.5">Rate limit window (min)</label>
            <input
              type="number" min={1} max={60}
              value={form.rateLimitWindowMinutes}
              onChange={e => setForm({ ...form, rateLimitWindowMinutes: parseInt(e.target.value) || 15 })}
              className="w-full bg-white/10 text-white border border-white/20 rounded-btn px-3 py-2 text-sm focus:border-vc-purple focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1.5">Suggest rate limit (msgs)</label>
            <input
              type="number" min={5} max={200}
              value={form.suggestRateLimit}
              onChange={e => setForm({ ...form, suggestRateLimit: parseInt(e.target.value) || 30 })}
              className="w-full bg-white/10 text-white border border-white/20 rounded-btn px-3 py-2 text-sm focus:border-vc-purple focus:outline-none"
            />
            <p className="text-xs text-white/30 mt-1">Per user per window</p>
          </div>
        </div>
      </div>

      {/* Cost Estimate */}
      <div className="glass-card p-6 border border-white/10">
        <h3 className="text-lg font-bold text-white mb-2">Estimated Cost (500 volunteers/day)</h3>
        <p className="text-white/40 text-xs mb-4">Rough estimate assuming ~20 messages per volunteer per day, ~2.5K input tokens + 500 output tokens per message.</p>

        <CostEstimate provider={form.provider} chatModel={form.chatModel} />
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-vc-purple text-white rounded-btn font-medium hover:bg-vc-purple-light transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <span className="text-vc-teal text-sm">Settings saved — takes effect immediately</span>}
      </div>

      {/* Divider */}
      <div className="border-t border-white/10 my-2" />

      {/* AI Prompt Instructions */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-white mb-2">AI Prompt Instructions</h3>
        <p className="text-white/50 text-sm mb-4">View and edit what the AI bots are instructed to do. Each section controls a different part of the coaching behavior. Optionally override per campaign type.</p>
        <PromptEditor />
      </div>
    </div>
  )
}

function CostEstimate({ provider, chatModel }: { provider: string; chatModel: string }) {
  // Price per 1M tokens: [input, output]
  const prices: Record<string, [number, number]> = {
    'claude-sonnet-4-6': [3, 15],
    'claude-haiku-4-5-20251001': [0.8, 4],
    'claude-opus-4-6': [15, 75],
    'gemini-2.5-flash-lite': [0.10, 0.40],
    'gemini-2.5-flash': [0.15, 0.60],
    'gemini-2.5-pro': [1.25, 10],
  }

  const [inputPrice, outputPrice] = prices[chatModel] || [1, 5]

  // 500 volunteers * 20 msgs * tokens per message
  const dailyInputTokens = 500 * 20 * 2500
  const dailyOutputTokens = 500 * 20 * 500
  const dailyCost = (dailyInputTokens / 1_000_000) * inputPrice + (dailyOutputTokens / 1_000_000) * outputPrice
  const monthlyCost = dailyCost * 30

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div>
        <p className="text-white/50 text-xs">Daily</p>
        <p className="text-xl font-bold text-white">${dailyCost.toFixed(0)}</p>
      </div>
      <div>
        <p className="text-white/50 text-xs">Monthly</p>
        <p className="text-xl font-bold text-white">${monthlyCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
      </div>
      <div>
        <p className="text-white/50 text-xs">Input price</p>
        <p className="text-sm text-white/70">${inputPrice}/1M tokens</p>
      </div>
      <div>
        <p className="text-white/50 text-xs">Output price</p>
        <p className="text-sm text-white/70">${outputPrice}/1M tokens</p>
      </div>
    </div>
  )
}

// ========== PROMPT EDITOR ==========

interface PromptSectionData {
  id: string
  label: string
  description: string
  content: string
  isDefault: boolean
  availableVariables: string[]
}

function PromptEditor() {
  const [sections, setSections] = useState<PromptSectionData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [campaignType, setCampaignType] = useState<string>('')
  const [editContent, setEditContent] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const loadSections = useCallback(async (ct?: string) => {
    setLoading(true)
    const url = ct ? `/api/platform/prompts?campaignType=${ct}` : '/api/platform/prompts'
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      setSections(data.sections)
      const edits: Record<string, string> = {}
      for (const s of data.sections) edits[s.id] = s.content
      setEditContent(edits)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadSections(campaignType || undefined) }, [campaignType, loadSections])

  const saveSection = async (sectionId: string) => {
    setSavingId(sectionId)
    setSavedId(null)
    const res = await fetch('/api/platform/prompts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId,
        content: editContent[sectionId],
        campaignType: campaignType || undefined,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setSections(prev => prev.map(s => s.id === sectionId ? data.section : s))
      setSavedId(sectionId)
      setTimeout(() => setSavedId(null), 3000)
    }
    setSavingId(null)
  }

  const resetSection = async (sectionId: string) => {
    setSavingId(sectionId)
    const res = await fetch('/api/platform/prompts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId,
        campaignType: campaignType || undefined,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setEditContent(prev => ({ ...prev, [sectionId]: data.defaultContent }))
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, content: data.defaultContent, isDefault: true } : s))
    }
    setSavingId(null)
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-white/30 animate-spin" /></div>

  return (
    <div className="space-y-4">
      {/* Campaign type filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-white/50">Viewing:</span>
        {[
          { value: '', label: 'Base (all campaigns)' },
          { value: 'candidate', label: 'Candidate' },
          { value: 'ballot-measure', label: 'Ballot Measure' },
          { value: 'issue-advocacy', label: 'Issue Advocacy' },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => { setCampaignType(opt.value); setExpandedId(null) }}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-medium transition-all',
              campaignType === opt.value
                ? 'bg-vc-purple text-white'
                : 'bg-white/10 text-white/50 hover:bg-white/15'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {campaignType && (
        <p className="text-xs text-white/40">
          Editing overrides for <strong className="text-white/60">{campaignType}</strong> campaigns. Sections without an override will fall back to the base prompt.
        </p>
      )}

      {/* Section accordion */}
      {sections.map(section => {
        const isExpanded = expandedId === section.id
        const hasChanges = editContent[section.id] !== section.content
        const charCount = (editContent[section.id] || '').length
        const estimatedTokens = Math.round(charCount / 4)

        return (
          <div key={section.id} className="glass-card overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : section.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
            >
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-white/40 flex-shrink-0" />
              }
              <FileText className="w-4 h-4 text-white/30 flex-shrink-0" />
              <span className="text-sm font-medium text-white flex-1">{section.label}</span>
              <span className={clsx(
                'text-xs px-2 py-0.5 rounded-full',
                section.isDefault ? 'bg-white/10 text-white/40' : 'bg-vc-purple/30 text-vc-purple-light'
              )}>
                {section.isDefault ? 'default' : 'customized'}
              </span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-white/40">{section.description}</p>

                {section.availableVariables.length > 0 && (
                  <div className="text-xs text-white/30">
                    <span className="text-white/50">Variables: </span>
                    {section.availableVariables.map(v => (
                      <code key={v} className="bg-white/10 px-1 py-0.5 rounded text-vc-teal mr-1">{`{{${v}}}`}</code>
                    ))}
                  </div>
                )}

                <textarea
                  value={editContent[section.id] || ''}
                  onChange={e => setEditContent(prev => ({ ...prev, [section.id]: e.target.value }))}
                  rows={16}
                  className="w-full bg-black/30 text-white/90 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono leading-relaxed focus:border-vc-purple focus:outline-none resize-y"
                  placeholder="Enter prompt instructions..."
                />

                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/30">
                    {charCount.toLocaleString()} chars / ~{estimatedTokens.toLocaleString()} tokens
                  </span>

                  <div className="flex items-center gap-2">
                    {savedId === section.id && (
                      <span className="text-vc-teal text-xs">Saved</span>
                    )}
                    {!section.isDefault && (
                      <button
                        onClick={() => resetSection(section.id)}
                        disabled={savingId === section.id}
                        className="px-3 py-1.5 text-xs text-white/50 hover:text-white border border-white/10 rounded-btn flex items-center gap-1.5 hover:bg-white/5 transition-all disabled:opacity-50"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset to Default
                      </button>
                    )}
                    <button
                      onClick={() => saveSection(section.id)}
                      disabled={savingId === section.id || !hasChanges}
                      className="px-4 py-1.5 text-xs bg-vc-purple text-white rounded-btn font-medium hover:bg-vc-purple-light transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {savingId === section.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Save Section
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <p className="text-xs text-white/30">Changes take effect within 60 seconds for active chat sessions.</p>
    </div>
  )
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

        {/* Quick link to Texting admin */}
        <NextLink
          href="/texting/admin"
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-btn text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-all ml-auto"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Texting</span>
          <ExternalLink className="w-3 h-3 opacity-50" />
        </NextLink>
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'organizations' && <OrganizationsTab />}
        {activeTab === 'campaigns' && <CampaignsTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'subscriptions' && <SubscriptionsTab />}
        {activeTab === 'voter-data' && <VoterDataTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}
