'use client'

import { useState, useEffect } from 'react'
import { X, Send, Mail, MessageSquare, Megaphone } from 'lucide-react'

interface EventBlastModalProps {
  eventId: string
  eventTitle: string
  isOpen: boolean
  onClose: () => void
}

type Channel = 'both' | 'email' | 'sms'

export default function EventBlastModal({ eventId, eventTitle, isOpen, onClose }: EventBlastModalProps) {
  const [message, setMessage] = useState('')
  const [channel, setChannel] = useState<Channel>('both')
  const [isSending, setIsSending] = useState(false)
  const [blastsRemaining, setBlastsRemaining] = useState<number | null>(null)
  const [result, setResult] = useState<{ emailsSent: number; smsSent: number } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      // Fetch blast history to get remaining count
      fetch(`/api/events/${eventId}/blast`)
        .then(res => res.json())
        .then(data => {
          if (data.blastsRemaining !== undefined) {
            setBlastsRemaining(data.blastsRemaining)
          }
        })
        .catch(() => {})

      // Reset state on open
      setMessage('')
      setResult(null)
      setError('')
    }
  }, [isOpen, eventId])

  if (!isOpen) return null

  async function handleSend() {
    if (!message.trim() || isSending) return
    setIsSending(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch(`/api/events/${eventId}/blast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), channel }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to send message')
      } else {
        setResult({ emailsSent: data.emailsSent, smsSent: data.smsSent })
        setBlastsRemaining(data.blastsRemaining)
      }
    } catch {
      setError('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg glass-card p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-vc-purple-light" />
            <h2 className="font-display text-lg font-bold text-white">Message Attendees</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        {result ? (
          /* Success state */
          <div className="text-center py-4 space-y-3">
            <div className="text-4xl">&#x2709;&#xFE0F;</div>
            <h3 className="font-display text-lg font-bold text-white">Message sent!</h3>
            <p className="text-white/60 text-sm">
              {result.emailsSent > 0 && `${result.emailsSent} email${result.emailsSent !== 1 ? 's' : ''}`}
              {result.emailsSent > 0 && result.smsSent > 0 && ' and '}
              {result.smsSent > 0 && `${result.smsSent} SMS`}
              {' '}sent to attendees of {eventTitle}.
            </p>
            {blastsRemaining !== null && (
              <p className="text-white/40 text-xs">
                {blastsRemaining} message{blastsRemaining !== 1 ? 's' : ''} remaining for this event
              </p>
            )}
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 bg-vc-purple hover:bg-vc-purple-light text-white rounded-btn font-medium text-sm transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          /* Compose state */
          <>
            {blastsRemaining !== null && (
              <p className="text-xs text-white/40">
                {blastsRemaining} of 3 messages remaining for this event
              </p>
            )}

            {/* Message textarea */}
            <div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value.slice(0, 500))}
                placeholder="Write your message to all attendees..."
                rows={5}
                className="w-full bg-white/5 border border-white/15 rounded-card p-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-vc-purple/50 focus:ring-1 focus:ring-vc-purple/30 resize-none"
                disabled={blastsRemaining === 0}
              />
              <div className="flex justify-end mt-1">
                <span className={`text-xs ${message.length >= 480 ? 'text-vc-coral' : 'text-white/30'}`}>
                  {message.length}/500
                </span>
              </div>
            </div>

            {/* Channel selector */}
            <div>
              <label className="text-xs font-medium text-white/50 mb-2 block">Send via</label>
              <div className="flex gap-2">
                {([
                  { value: 'both' as Channel, label: 'Email + SMS', icon: <><Mail className="w-3.5 h-3.5" /><MessageSquare className="w-3.5 h-3.5" /></> },
                  { value: 'email' as Channel, label: 'Email only', icon: <Mail className="w-3.5 h-3.5" /> },
                  { value: 'sms' as Channel, label: 'SMS only', icon: <MessageSquare className="w-3.5 h-3.5" /> },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setChannel(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-medium transition-all ${
                      channel === opt.value
                        ? 'bg-vc-purple/20 border border-vc-purple/40 text-white'
                        : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-vc-coral bg-vc-coral/10 border border-vc-coral/20 rounded-btn px-3 py-2">
                {error}
              </p>
            )}

            {/* Send button */}
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!message.trim() || isSending || blastsRemaining === 0}
                className="flex items-center gap-2 px-5 py-2 bg-vc-purple hover:bg-vc-purple-light text-white rounded-btn font-medium text-sm shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {isSending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
