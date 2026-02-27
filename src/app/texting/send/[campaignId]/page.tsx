'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, SkipForward, LogOut as DoneIcon, Loader2, Check, AlertCircle } from 'lucide-react'
import type { TextCampaignContact, TextCampaignScript } from '@/types/texting'

export default function SendTextsPage() {
  const { user } = useAuth()
  const params = useParams()
  const campaignId = params.campaignId as string

  const [currentContact, setCurrentContact] = useState<TextCampaignContact | null>(null)
  const [script, setScript] = useState<TextCampaignScript | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [sentCount, setSentCount] = useState(0)
  const [totalAssigned, setTotalAssigned] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [lastSentName, setLastSentName] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!user || !campaignId) return
    loadData()
  }, [user, campaignId])

  async function loadData() {
    setIsLoading(true)
    try {
      // Get scripts
      const scriptsRes = await fetch(`/api/texting/campaigns/${campaignId}/scripts?type=initial`)
      const scriptsData = await scriptsRes.json()
      if (scriptsData.scripts?.length > 0) {
        setScript(scriptsData.scripts[0])
      }

      // Get contacts assigned to me
      const contactsRes = await fetch(`/api/texting/campaigns/${campaignId}/contacts?assignedTo=${user!.id}&status=pending&limit=1`)
      const contactsData = await contactsRes.json()
      setTotalAssigned(contactsData.total || 0)

      if (contactsData.contacts?.length > 0) {
        setCurrentContact(contactsData.contacts[0])
      } else {
        setDone(true)
      }
    } finally {
      setIsLoading(false)
    }
  }

  function interpolate(body: string, contact: TextCampaignContact): string {
    return body
      .replace(/\{firstName\}/g, contact.firstName)
      .replace(/\{lastName\}/g, contact.lastName)
      .replace(/\{fullName\}/g, `${contact.firstName} ${contact.lastName}`)
  }

  async function handleSend() {
    if (!currentContact || !script) return
    setIsSending(true)
    setError(null)

    try {
      const res = await fetch(`/api/texting/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: currentContact.id }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to send')
        return
      }

      setLastSentName(`${currentContact.firstName} ${currentContact.lastName}`)
      setSentCount(prev => prev + 1)

      if (data.nextContact) {
        setCurrentContact(data.nextContact)
      } else {
        setCurrentContact(null)
        setDone(true)
      }
    } catch {
      setError('Network error')
    } finally {
      setIsSending(false)
    }
  }

  async function handleDoneForTheDay() {
    await fetch(`/api/texting/campaigns/${campaignId}/assignments`, {
      method: 'DELETE',
    })
    setDone(true)
    setCurrentContact(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-vc-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-vc-bg">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/texting" className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to My Texts
        </Link>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-white/60">Progress</span>
            <span className="text-amber-400 font-medium">{sentCount} sent{totalAssigned > 0 ? ` of ${totalAssigned}` : ''}</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: totalAssigned > 0 ? `${(sentCount / totalAssigned) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {lastSentName && (
          <div className="flex items-center gap-2 text-green-400 text-sm mb-4 animate-fade-in">
            <Check className="w-4 h-4" />
            Sent to {lastSentName}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {done ? (
          <div className="bg-vc-surface border border-white/10 rounded-xl p-12 text-center">
            <Check className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">
              {sentCount > 0 ? 'All done!' : 'No texts to send'}
            </h2>
            <p className="text-white/60 mb-6">
              {sentCount > 0
                ? `You sent ${sentCount} text${sentCount !== 1 ? 's' : ''} this session.`
                : 'You have no pending contacts assigned. Ask your admin to assign you a batch.'}
            </p>
            <Link
              href="/texting"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-black font-semibold rounded-btn hover:bg-amber-400 transition-colors"
            >
              Back to My Texts
            </Link>
          </div>
        ) : currentContact && script ? (
          <div className="space-y-6">
            {/* Contact card */}
            <div className="bg-vc-surface border border-white/10 rounded-xl p-5">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Sending to</div>
              <div className="text-lg font-semibold text-white">
                {currentContact.firstName} {currentContact.lastName}
              </div>
              <div className="text-sm text-white/40">{currentContact.cell}</div>
            </div>

            {/* Message preview */}
            <div className="bg-vc-surface border border-white/10 rounded-xl p-5">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-3">Message</div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <p className="text-white whitespace-pre-wrap">
                  {interpolate(script.body, currentContact)}
                </p>
              </div>
              <p className="text-xs text-white/30 mt-2">
                {interpolate(script.body, currentContact).length} characters
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSend}
                disabled={isSending}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-black font-bold rounded-btn hover:bg-amber-400 disabled:opacity-50 transition-colors text-lg"
              >
                {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>

            <button
              onClick={handleDoneForTheDay}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white/40 hover:text-white hover:bg-white/5 rounded-btn transition-colors"
            >
              <DoneIcon className="w-4 h-4" />
              Done for the day (release remaining)
            </button>
          </div>
        ) : (
          <div className="bg-vc-surface border border-white/10 rounded-xl p-12 text-center">
            <AlertCircle className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">No script configured</h2>
            <p className="text-white/60">Ask your campaign admin to set up an initial message script.</p>
          </div>
        )}
      </div>
    </div>
  )
}
