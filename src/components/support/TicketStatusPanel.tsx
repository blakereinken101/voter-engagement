'use client'

import { useState, useEffect, useCallback } from 'react'
import { CircleDot, Clock, CheckCircle2, XCircle, MessageCircle, ChevronRight } from 'lucide-react'
import type { SupportTicket, TicketStatus } from '@/types'

const STATUS_CONFIG: Record<TicketStatus, { icon: typeof CircleDot; color: string; label: string }> = {
  'open': { icon: CircleDot, color: 'text-blue-400', label: 'Open' },
  'in-progress': { icon: Clock, color: 'text-yellow-400', label: 'In Progress' },
  'waiting-on-user': { icon: Clock, color: 'text-orange-400', label: 'Waiting on You' },
  'resolved': { icon: CheckCircle2, color: 'text-green-400', label: 'Resolved' },
  'closed': { icon: XCircle, color: 'text-white/40', label: 'Closed' },
}

interface Props {
  onSelectTicket?: (ticket: SupportTicket) => void
}

export default function TicketStatusPanel({ onSelectTicket }: Props) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)

  const loadTickets = useCallback(async () => {
    try {
      const res = await fetch('/api/support/tickets')
      if (res.ok) {
        const data = await res.json()
        setTickets(data.tickets)
      }
    } catch (err) {
      console.error('Failed to load tickets:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffHours < 1) return 'just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/10">
        <h4 className="text-sm font-medium">Your Tickets</h4>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-center text-white/30 text-sm py-8">Loading...</p>
        ) : tickets.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-6 h-6 text-white/15 mx-auto mb-2" />
            <p className="text-white/30 text-xs">No tickets yet</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {tickets.map(ticket => {
              const cfg = STATUS_CONFIG[ticket.status]
              const StatusIcon = cfg.icon
              return (
                <button
                  key={ticket.id}
                  onClick={() => onSelectTicket?.(ticket)}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <StatusIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ticket.subject}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-white/40">
                        <span>{cfg.label}</span>
                        <span>&middot;</span>
                        <span>{formatDate(ticket.createdAt)}</span>
                        {ticket.messageCount !== undefined && ticket.messageCount > 0 && (
                          <>
                            <span>&middot;</span>
                            <span className="flex items-center gap-0.5">
                              <MessageCircle className="w-3 h-3" />
                              {ticket.messageCount}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
