'use client'

import { useState } from 'react'
import { Bell, Send, CheckCircle, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

export default function SendPushNotification() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canSend = title.trim() && body.trim()

  async function handleSend() {
    if (!canSend) return
    setSending(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to send')
      } else {
        setResult({ sent: data.sent, failed: data.failed })
        // Clear form on success
        setTitle('')
        setBody('')
        setUrl('')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-vc-purple-light" />
        <h2 className="text-lg font-bold text-white">Send Push Notification</h2>
      </div>

      <p className="text-sm text-white/60">
        Send a push notification to all campaign members who have enabled notifications (iOS and web).
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekend Canvass Reminder"
            className="w-full px-4 py-2.5 rounded-btn bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-vc-purple/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="e.g. Don't forget to reach out to your contacts this weekend!"
            rows={3}
            className="w-full px-4 py-2.5 rounded-btn bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-vc-purple/50 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">
            Link URL <span className="text-white/30">(optional)</span>
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/dashboard"
            className="w-full px-4 py-2.5 rounded-btn bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-vc-purple/50"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!canSend || sending}
          className={clsx(
            'flex items-center justify-center gap-2 w-full px-4 py-3 rounded-btn text-sm font-bold transition-all',
            canSend && !sending
              ? 'bg-vc-purple text-white hover:bg-vc-purple/80 shadow-glow'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
          )}
        >
          {sending ? (
            <span className="text-white/60">Sending...</span>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send Push Notification
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="flex items-center gap-2 p-3 rounded-btn bg-vc-teal/10 border border-vc-teal/20">
          <CheckCircle className="w-4 h-4 text-vc-teal flex-shrink-0" />
          <span className="text-sm text-vc-teal">
            Sent to {result.sent} {result.sent === 1 ? 'device' : 'devices'}
            {result.failed > 0 && ` (${result.failed} failed)`}
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-btn bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}
    </div>
  )
}
