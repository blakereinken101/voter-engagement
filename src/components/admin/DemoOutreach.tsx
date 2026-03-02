'use client'

import { useState, FormEvent } from 'react'
import { Send, CheckCircle } from 'lucide-react'

export default function DemoOutreach() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError('')

    try {
      const res = await fetch('/api/admin/demo-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, organization: organization || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send')
      }
      setSentTo(name.split(' ')[0])
      setStatus('sent')
      setName('')
      setEmail('')
      setOrganization('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email')
      setStatus('error')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-white mb-1">Demo Outreach</h3>
        <p className="text-white/50 text-sm">Send a personalized demo booking email to leads who&rsquo;ve expressed interest.</p>
      </div>

      {status === 'sent' && (
        <div className="glass-card p-4 flex items-center gap-3 border border-vc-teal/30">
          <CheckCircle className="w-5 h-5 text-vc-teal flex-shrink-0" />
          <p className="text-white/70 text-sm">
            Demo email sent to <span className="text-white font-semibold">{sentTo}</span>! They&rsquo;ll get a link to book directly on Cal.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-1">Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="glass-input w-full rounded-btn h-10 px-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-vc-purple/50"
              placeholder="Their name"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-1">Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="glass-input w-full rounded-btn h-10 px-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-vc-purple/50"
              placeholder="their@email.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-white/70 mb-1">Organization / Campaign <span className="text-white/30">(optional)</span></label>
          <input
            type="text"
            value={organization}
            onChange={e => setOrganization(e.target.value)}
            className="glass-input w-full rounded-btn h-10 px-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-vc-purple/50"
            placeholder="Their campaign or org"
          />
        </div>

        {status === 'error' && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={status === 'sending'}
          className="w-full bg-vc-purple hover:bg-vc-purple-light text-white font-bold py-2.5 rounded-btn text-sm transition-all hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {status === 'sending' ? (
            'Sending...'
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send Demo Email
            </>
          )}
        </button>
      </form>
    </div>
  )
}
