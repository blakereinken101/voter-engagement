'use client'

import { useState } from 'react'
import { Ticket, BookOpen } from 'lucide-react'
import clsx from 'clsx'
import type { SupportTicket } from '@/types'
import TicketList from './TicketList'
import TicketDetail from './TicketDetail'
import KBManager from './KBManager'

type SubTab = 'tickets' | 'knowledge-base'

export default function SupportDashboard() {
  const [subTab, setSubTab] = useState<SubTab>('tickets')
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 glass-card p-1 w-fit">
        <button
          onClick={() => { setSubTab('tickets'); setSelectedTicketId(null) }}
          className={clsx(
            'flex items-center gap-1.5 px-4 py-2 rounded-btn text-sm font-medium transition-all',
            subTab === 'tickets' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70',
          )}
        >
          <Ticket className="w-4 h-4" />
          Tickets
        </button>
        <button
          onClick={() => setSubTab('knowledge-base')}
          className={clsx(
            'flex items-center gap-1.5 px-4 py-2 rounded-btn text-sm font-medium transition-all',
            subTab === 'knowledge-base' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70',
          )}
        >
          <BookOpen className="w-4 h-4" />
          Knowledge Base
        </button>
      </div>

      {/* Content */}
      <div className="animate-fade-in">
        {subTab === 'tickets' && !selectedTicketId && (
          <TicketList onSelectTicket={(t) => setSelectedTicketId(t.id)} />
        )}
        {subTab === 'tickets' && selectedTicketId && (
          <TicketDetail ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />
        )}
        {subTab === 'knowledge-base' && <KBManager />}
      </div>
    </div>
  )
}
