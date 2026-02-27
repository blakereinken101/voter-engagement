'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import { Plus, Archive, Play, Pause, Loader2, MessageSquare, Users, Ban } from 'lucide-react'
import type { TextCampaign } from '@/types/texting'

export default function TextingAdminPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [campaigns, setCampaigns] = useState<TextCampaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'paused' | 'archived'>('all')

  useEffect(() => {
    if (!user) return
    fetch('/api/texting/campaigns')
      .then(res => res.json())
      .then(data => setCampaigns(data.campaigns || []))
      .finally(() => setIsLoading(false))
  }, [user])

  const filtered = filter === 'all' ? campaigns : campaigns.filter(c => c.status === filter)

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/texting/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: status as TextCampaign['status'] } : c))
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-vc-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-vc-bg">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Text Campaigns</h1>
            <p className="text-white/60 mt-1">Create and manage P2P texting campaigns</p>
          </div>
          <Link
            href="/texting/admin/create"
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black font-semibold rounded-btn hover:bg-amber-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(['all', 'active', 'draft', 'paused', 'archived'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-btn transition-colors ${
                filter === f
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-vc-surface border border-white/10 rounded-xl p-12 text-center">
            <MessageSquare className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">
              {filter === 'all' ? 'No campaigns yet' : `No ${filter} campaigns`}
            </h2>
            <p className="text-white/60 mb-6">
              {filter === 'all' ? 'Create your first texting campaign to get started.' : `You don't have any ${filter} campaigns.`}
            </p>
            {filter === 'all' && (
              <Link
                href="/texting/admin/create"
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-black font-semibold rounded-btn hover:bg-amber-400 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Campaign
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(campaign => (
              <div key={campaign.id} className="bg-vc-surface border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <Link
                        href={`/texting/admin/${campaign.id}`}
                        className="text-lg font-semibold text-white hover:text-amber-400 transition-colors truncate"
                      >
                        {campaign.title}
                      </Link>
                      <StatusBadge status={campaign.status} />
                      <span className="text-xs text-white/40 uppercase">
                        {campaign.sendingMode}
                      </span>
                    </div>
                    {campaign.description && (
                      <p className="text-sm text-white/50 truncate">{campaign.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-6 ml-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{campaign.contactCount || 0}</div>
                      <div className="text-xs text-white/40">Contacts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-amber-400">{campaign.sentCount || 0}</div>
                      <div className="text-xs text-white/40">Sent</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-400">{campaign.repliedCount || 0}</div>
                      <div className="text-xs text-white/40">Replies</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-400">{campaign.optedOutCount || 0}</div>
                      <div className="text-xs text-white/40">Opt-outs</div>
                    </div>

                    <div className="flex items-center gap-1 ml-2">
                      {campaign.status === 'draft' && (
                        <button
                          onClick={() => updateStatus(campaign.id, 'active')}
                          className="p-1.5 text-green-400 hover:bg-green-400/10 rounded transition-colors"
                          title="Activate"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {campaign.status === 'active' && (
                        <button
                          onClick={() => updateStatus(campaign.id, 'paused')}
                          className="p-1.5 text-yellow-400 hover:bg-yellow-400/10 rounded transition-colors"
                          title="Pause"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {campaign.status === 'paused' && (
                        <button
                          onClick={() => updateStatus(campaign.id, 'active')}
                          className="p-1.5 text-green-400 hover:bg-green-400/10 rounded transition-colors"
                          title="Resume"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {campaign.status !== 'archived' && (
                        <button
                          onClick={() => updateStatus(campaign.id, 'archived')}
                          className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                          title="Archive"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-white/10 text-white/60',
    active: 'bg-green-500/20 text-green-400',
    paused: 'bg-yellow-500/20 text-yellow-400',
    archived: 'bg-white/5 text-white/30',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] || styles.draft}`}>
      {status}
    </span>
  )
}
