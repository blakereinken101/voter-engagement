'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp, User, Bot, Lock } from 'lucide-react'
import type { SupportTicket, SupportTicketMessage, SupportTicketEvent, TicketStatus, TicketPriority, TicketCategory } from '@/types'
import { TICKET_STATUSES, TICKET_PRIORITIES, TICKET_CATEGORIES } from '@/types'
import TicketReplyForm from './TicketReplyForm'

interface Props {
  ticketId: string
  onBack: () => void
}

export default function TicketDetail({ ticketId, onBack }: Props) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<SupportTicketMessage[]>([])
  const [events, setEvents] = useState<SupportTicketEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAiConversation, setShowAiConversation] = useState(false)
  const [updating, setUpdating] = useState(false)

  const loadTicket = useCallback(async () => {
    try {
      const [ticketRes, msgRes] = await Promise.all([
        fetch(`/api/support/tickets/${ticketId}`),
        fetch(`/api/support/tickets/${ticketId}/messages`),
      ])

      if (ticketRes.ok) {
        const data = await ticketRes.json()
        setTicket(data.ticket)
        setEvents(data.events || [])
      }
      if (msgRes.ok) {
        const data = await msgRes.json()
        setMessages(data.messages)
      }
    } catch (err) {
      console.error('Failed to load ticket:', err)
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    loadTicket()
  }, [loadTicket])

  const handleUpdate = async (field: string, value: string) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (res.ok) {
        const data = await res.json()
        setTicket(data.ticket)
      }
    } catch (err) {
      console.error('Failed to update ticket:', err)
    } finally {
      setUpdating(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  }

  if (loading) {
    return <div className="text-center text-white/40 py-8">Loading ticket...</div>
  }

  if (!ticket) {
    return <div className="text-center text-white/40 py-8">Ticket not found</div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="space-y-3 pb-3 border-b border-white/10">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to tickets
        </button>

        <h3 className="text-lg font-semibold">{ticket.subject}</h3>

        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>From: <strong className="text-white/60">{ticket.userName || ticket.userEmail}</strong></span>
          <span>&middot;</span>
          <span>{formatDate(ticket.createdAt)}</span>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={ticket.status}
            onChange={e => handleUpdate('status', e.target.value)}
            disabled={updating}
            className="glass-input px-2 py-1 rounded text-xs"
          >
            {TICKET_STATUSES.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

          <select
            value={ticket.priority}
            onChange={e => handleUpdate('priority', e.target.value)}
            disabled={updating}
            className="glass-input px-2 py-1 rounded text-xs"
          >
            {TICKET_PRIORITIES.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>

          <select
            value={ticket.category}
            onChange={e => handleUpdate('category', e.target.value)}
            disabled={updating}
            className="glass-input px-2 py-1 rounded text-xs"
          >
            {TICKET_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* AI Conversation (collapsible) */}
      {ticket.aiConversation && ticket.aiConversation.length > 0 && (
        <div className="border-b border-white/10">
          <button
            onClick={() => setShowAiConversation(!showAiConversation)}
            className="flex items-center gap-2 w-full p-3 text-sm text-white/50 hover:text-white/70 transition-colors"
          >
            <Bot className="w-4 h-4 text-vc-purple" />
            AI Triage Conversation ({ticket.aiConversation.length} messages)
            {showAiConversation ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
          </button>

          {showAiConversation && (
            <div className="px-3 pb-3 space-y-2">
              {ticket.aiConversation.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === 'user' ? '' : 'pl-4'}`}
                >
                  <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    msg.role === 'user' ? 'bg-vc-teal/20 text-vc-teal' : 'bg-vc-purple/20 text-vc-purple'
                  }`}>
                    {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed">{msg.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-white/30 text-sm py-4">No messages yet</p>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`rounded-xl p-3 ${
                msg.isInternalNote
                  ? 'bg-amber-500/10 border border-amber-500/20'
                  : 'bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">
                  {msg.senderName || 'Unknown'}
                </span>
                {msg.senderRole && (
                  <span className="text-xs text-white/30">{msg.senderRole}</span>
                )}
                {msg.isInternalNote && (
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <Lock className="w-3 h-3" />
                    Internal
                  </span>
                )}
                {msg.aiSuggested && (
                  <span className="text-xs text-vc-purple">AI suggested</span>
                )}
                <span className="text-xs text-white/30 ml-auto">{formatDate(msg.createdAt)}</span>
              </div>
              <p className="text-sm text-white/70 whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))
        )}
      </div>

      {/* Reply Form */}
      <TicketReplyForm ticketId={ticketId} onSent={loadTicket} />
    </div>
  )
}
