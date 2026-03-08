'use client'

import { useState } from 'react'
import { Send, Sparkles, Lock } from 'lucide-react'

interface Props {
  ticketId: string
  onSent: () => void
}

export default function TicketReplyForm({ ticketId, onSent }: Props) {
  const [content, setContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    if (!content.trim()) return
    setSending(true)
    setError('')

    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), isInternalNote: isInternal }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send')
      }

      setContent('')
      onSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const handleSuggest = async () => {
    setSuggesting(true)
    setError('')

    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate suggestion')
      }

      const data = await res.json()
      setContent(data.suggestion)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestion')
    } finally {
      setSuggesting(false)
    }
  }

  return (
    <div className="border-t border-white/10 p-3 space-y-2">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        className="glass-input w-full px-3 py-2 rounded-btn text-sm min-h-[80px] resize-y"
        placeholder={isInternal ? 'Write an internal note...' : 'Write a reply...'}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
        }}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={e => setIsInternal(e.target.checked)}
              className="rounded"
            />
            <Lock className="w-3 h-3 text-amber-400" />
            <span className="text-white/50">Internal note</span>
          </label>

          <button
            onClick={handleSuggest}
            disabled={suggesting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3 h-3 text-vc-purple" />
            {suggesting ? 'Generating...' : 'AI Suggest'}
          </button>
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !content.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-vc-purple text-white rounded-btn text-sm font-medium hover:bg-vc-purple/80 transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
