'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play, Pause, Send, Users, MessageSquare, BarChart3, Zap, Loader2, Archive } from 'lucide-react'
import type { TextCampaign, TextCampaignStats, TextCampaignScript } from '@/types/texting'

export default function CampaignDetailPage() {
  const { user } = useAuth()
  const params = useParams()
  const campaignId = params.campaignId as string

  const [campaign, setCampaign] = useState<TextCampaign | null>(null)
  const [stats, setStats] = useState<TextCampaignStats | null>(null)
  const [scripts, setScripts] = useState<TextCampaignScript[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [blastLoading, setBlastLoading] = useState(false)
  const [blastResult, setBlastResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null)

  useEffect(() => {
    if (!user || !campaignId) return
    Promise.all([
      fetch(`/api/texting/campaigns/${campaignId}`).then(r => r.json()),
      fetch(`/api/texting/campaigns/${campaignId}/stats`).then(r => r.json()),
      fetch(`/api/texting/campaigns/${campaignId}/scripts`).then(r => r.json()),
    ]).then(([campaignData, statsData, scriptsData]) => {
      setCampaign(campaignData.campaign)
      setStats(statsData.stats)
      setScripts(scriptsData.scripts || [])
    }).finally(() => setIsLoading(false))
  }, [user, campaignId])

  async function updateStatus(status: string) {
    const res = await fetch(`/api/texting/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const data = await res.json()
      setCampaign(data.campaign)
    }
  }

  async function handleBlast() {
    setBlastLoading(true)
    setBlastResult(null)
    try {
      const res = await fetch(`/api/texting/campaigns/${campaignId}/blast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 100 }),
      })
      const data = await res.json()
      if (res.ok) {
        setBlastResult(data)
        // Refresh stats
        const statsRes = await fetch(`/api/texting/campaigns/${campaignId}/stats`)
        const statsData = await statsRes.json()
        setStats(statsData.stats)
      }
    } finally {
      setBlastLoading(false)
    }
  }

  if (isLoading || !campaign) {
    return (
      <div className="min-h-screen bg-vc-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-vc-bg">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link href="/texting/admin" className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Campaigns
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{campaign.title}</h1>
              <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${
                campaign.status === 'active' ? 'bg-green-500/20 text-green-400' :
                campaign.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                campaign.status === 'draft' ? 'bg-white/10 text-white/60' :
                'bg-white/5 text-white/30'
              }`}>
                {campaign.status}
              </span>
            </div>
            {campaign.description && <p className="text-white/50 mt-1">{campaign.description}</p>}
          </div>
          <div className="flex gap-2">
            {campaign.status === 'draft' && (
              <button onClick={() => updateStatus('active')} className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-btn hover:bg-green-500/30 transition-colors">
                <Play className="w-4 h-4" /> Activate
              </button>
            )}
            {campaign.status === 'active' && (
              <button onClick={() => updateStatus('paused')} className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-btn hover:bg-yellow-500/30 transition-colors">
                <Pause className="w-4 h-4" /> Pause
              </button>
            )}
            {campaign.status === 'paused' && (
              <button onClick={() => updateStatus('active')} className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-btn hover:bg-green-500/30 transition-colors">
                <Play className="w-4 h-4" /> Resume
              </button>
            )}
            {campaign.status !== 'archived' && (
              <button onClick={() => updateStatus('archived')} className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white/40 rounded-btn hover:bg-red-500/10 hover:text-red-400 transition-colors">
                <Archive className="w-4 h-4" /> Archive
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
            {[
              { label: 'Total Contacts', value: stats.totalContacts, color: 'text-white' },
              { label: 'Pending', value: stats.pending, color: 'text-white/50' },
              { label: 'Sent', value: stats.sent, color: 'text-amber-400' },
              { label: 'Replied', value: stats.replied, color: 'text-green-400' },
              { label: 'Opted Out', value: stats.optedOut, color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-vc-surface border border-white/10 rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-white/40 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link href={`/texting/send/${campaignId}`} className="bg-vc-surface border border-white/10 rounded-xl p-5 hover:border-amber-500/30 transition-colors group">
            <Send className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-semibold text-white">Send Texts</div>
            <div className="text-sm text-white/40">P2P sending interface</div>
          </Link>
          <Link href={`/texting/reply/${campaignId}`} className="bg-vc-surface border border-white/10 rounded-xl p-5 hover:border-green-500/30 transition-colors group">
            <MessageSquare className="w-6 h-6 text-green-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-semibold text-white">Reply to Messages</div>
            <div className="text-sm text-white/40">Handle incoming replies</div>
          </Link>
          <Link href={`/texting/admin/${campaignId}`} className="bg-vc-surface border border-white/10 rounded-xl p-5 hover:border-vc-purple/30 transition-colors group">
            <Users className="w-6 h-6 text-vc-purple-light mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-semibold text-white">Assignments</div>
            <div className="text-sm text-white/40">Manage texter assignments</div>
          </Link>
          <div className="bg-vc-surface border border-white/10 rounded-xl p-5">
            <BarChart3 className="w-6 h-6 text-white/40 mb-2" />
            <div className="font-semibold text-white">Message Review</div>
            <div className="text-sm text-white/40">View all conversations</div>
          </div>
        </div>

        {/* Blast Mode */}
        {campaign.sendingMode === 'blast' && campaign.status === 'active' && (
          <div className="bg-vc-surface border border-amber-500/20 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <h3 className="font-semibold text-white">Blast Mode</h3>
                </div>
                <p className="text-sm text-white/50">Send initial messages to all pending contacts automatically.</p>
                {blastResult && (
                  <p className="text-sm text-amber-400 mt-2">
                    Sent: {blastResult.sent} | Failed: {blastResult.failed} | Skipped: {blastResult.skipped}
                  </p>
                )}
              </div>
              <button
                onClick={handleBlast}
                disabled={blastLoading || !stats || stats.pending === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-black font-semibold rounded-btn hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                {blastLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {blastLoading ? 'Sending...' : `Send to ${stats?.pending || 0} contacts`}
              </button>
            </div>
          </div>
        )}

        {/* Scripts */}
        <div className="bg-vc-surface border border-white/10 rounded-xl p-6">
          <h3 className="font-semibold text-white mb-4">Scripts ({scripts.length})</h3>
          {scripts.length === 0 ? (
            <p className="text-white/40 text-sm">No scripts configured yet.</p>
          ) : (
            <div className="space-y-3">
              {scripts.map(script => (
                <div key={script.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      script.scriptType === 'initial' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/60'
                    }`}>
                      {script.scriptType === 'initial' ? 'Initial' : 'Canned Response'}
                    </span>
                    {script.title && <span className="text-sm font-medium text-white">{script.title}</span>}
                  </div>
                  <p className="text-sm text-white/60 whitespace-pre-wrap">{script.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
