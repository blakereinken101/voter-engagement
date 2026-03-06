'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Megaphone, Send, ArrowLeft } from 'lucide-react'

export default function BroadcastPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <p className="text-white/50">Only campaign admins can send broadcasts.</p>
      </div>
    )
  }

  const send = async () => {
    if (!content.trim() || isSending) return
    setIsSending(true)
    setError('')

    try {
      const res = await fetch('/api/messaging/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setSent(true)
        setTimeout(() => router.push(`/messaging/${data.broadcastChannelId}`), 1500)
      } else {
        const data = await res.json().catch(() => ({ error: 'Failed to send' }))
        setError(data.error)
      }
    } catch {
      setError('Network error')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <button
        onClick={() => router.push('/messaging')}
        className="flex items-center gap-1 text-sm text-white/40 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Messages
      </button>

      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Send Broadcast</h1>
            <p className="text-sm text-white/40">Your message will go to everyone in the campaign.</p>
          </div>
        </div>

        {sent ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
              <Send className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-white font-medium">Broadcast sent!</p>
            <p className="text-sm text-white/40 mt-1">Redirecting to the announcements channel...</p>
          </div>
        ) : (
          <>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your announcement..."
              rows={5}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 resize-none"
              autoFocus
            />

            {error && <p className="text-sm text-red-400 mt-2">{error}</p>}

            <div className="flex justify-end mt-4">
              <button
                onClick={send}
                disabled={!content.trim() || isSending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-btn bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-40 transition-colors"
              >
                <Megaphone className="w-4 h-4" />
                {isSending ? 'Sending...' : 'Send Broadcast'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
