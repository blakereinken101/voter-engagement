'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import { MessageSquare, Send, Reply, Loader2 } from 'lucide-react'
import type { TextCampaign } from '@/types/texting'

interface CampaignWithCounts extends TextCampaign {
  pendingCount?: number
  replyCount?: number
}

export default function TexterHomePage() {
  const { user, isLoading: authLoading } = useAuth()
  const [campaigns, setCampaigns] = useState<CampaignWithCounts[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetch('/api/texting/campaigns')
      .then(res => res.json())
      .then(data => {
        setCampaigns(data.campaigns?.filter((c: TextCampaign) => c.status === 'active') || [])
      })
      .finally(() => setIsLoading(false))
  }, [user])

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-vc-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-vc-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">My Texting Campaigns</h1>
            <p className="text-white/60 mt-1">Send texts and reply to conversations</p>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <div className="bg-vc-surface border border-white/10 rounded-xl p-12 text-center">
            <MessageSquare className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">No active campaigns</h2>
            <p className="text-white/60">You haven&apos;t been assigned to any texting campaigns yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map(campaign => (
              <div key={campaign.id} className="bg-vc-surface border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-white">{campaign.title}</h2>
                  <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 rounded-full">
                    Active
                  </span>
                </div>
                {campaign.description && (
                  <p className="text-sm text-white/60 mb-4">{campaign.description}</p>
                )}

                <div className="flex items-center gap-3 text-sm text-white/50 mb-4">
                  <span>{campaign.contactCount || 0} contacts</span>
                  <span>-</span>
                  <span>{campaign.sentCount || 0} sent</span>
                  <span>-</span>
                  <span>{campaign.repliedCount || 0} replies</span>
                </div>

                <div className="flex gap-3">
                  <Link
                    href={`/texting/send/${campaign.id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black font-medium rounded-btn hover:bg-amber-400 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    Send Texts
                  </Link>
                  <Link
                    href={`/texting/reply/${campaign.id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white font-medium rounded-btn hover:bg-white/20 transition-colors"
                  >
                    <Reply className="w-4 h-4" />
                    Reply to Messages
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
