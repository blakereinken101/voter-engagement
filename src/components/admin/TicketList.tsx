'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Filter, CircleDot, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { SupportTicket, TicketStatus, TicketPriority } from '@/types'

const STATUS_CONFIG: Record<TicketStatus, { icon: typeof CircleDot; color: string; label: string }> = {
  'open': { icon: CircleDot, color: 'text-blue-400', label: 'Open' },
  'in-progress': { icon: Clock, color: 'text-yellow-400', label: 'In Progress' },
  'waiting-on-user': { icon: Clock, color: 'text-orange-400', label: 'Waiting' },
  'resolved': { icon: CheckCircle2, color: 'text-green-400', label: 'Resolved' },
  'closed': { icon: XCircle, color: 'text-white/40', label: 'Closed' },
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'bg-white/10 text-white/50',
  normal: 'bg-blue-500/20 text-blue-400',
  high: 'bg-orange-500/20 text-orange-400',
  urgent: 'bg-red-500/20 text-red-400',
}

interface Props {
  onSelectTicket: (ticket: SupportTicket) => void
}

export default function TicketList({ onSelectTicket }: Props) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('active')

  const loadTickets = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all' && statusFilter !== 'active') {
        params.set('status', statusFilter)
      }
      const res = await fetch(`/api/support/tickets?${params}`)
      if (res.ok) {
        const data = await res.json()
        let filtered = data.tickets as SupportTicket[]
        if (statusFilter === 'active') {
          filtered = filtered.filter(t => t.status !== 'closed' && t.status !== 'resolved')
        }
        setTickets(filtered)
      }
    } catch (err) {
      console.error('Failed to load tickets:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {['active', 'open', 'in-progress', 'waiting-on-user', 'resolved', 'closed', 'all'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s ? 'bg-vc-purple text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            {s === 'active' ? 'Active' : s === 'all' ? 'All' : STATUS_CONFIG[s as TicketStatus]?.label || s}
          </button>
        ))}
      </div>

      {/* Ticket List */}
      {loading ? (
        <div className="text-center text-white/40 py-8">Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle2 className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-sm">No tickets found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map(ticket => {
            const statusCfg = STATUS_CONFIG[ticket.status]
            const StatusIcon = statusCfg.icon
            return (
              <button
                key={ticket.id}
                onClick={() => onSelectTicket(ticket)}
                className="glass-row w-full text-left p-3 rounded-xl hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <StatusIcon className={`w-4 h-4 mt-0.5 shrink-0 ${statusCfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm truncate">{ticket.subject}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_COLORS[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                      <span>{ticket.userName || 'Unknown'}</span>
                      <span className="px-2 py-0.5 rounded-full bg-white/5">{ticket.category}</span>
                      <span>{formatDate(ticket.createdAt)}</span>
                      {ticket.messageCount !== undefined && ticket.messageCount > 0 && (
                        <span>{ticket.messageCount} message{ticket.messageCount > 1 ? 's' : ''}</span>
                      )}
                      {ticket.assignedName && (
                        <span className="text-vc-teal">→ {ticket.assignedName}</span>
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
  )
}
