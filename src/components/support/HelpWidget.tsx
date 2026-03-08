'use client'

import { useState } from 'react'
import { HelpCircle, X, Bot, BookOpen, Ticket } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'
import SupportChatPanel from './SupportChatPanel'
import KnowledgeBaseBrowser from './KnowledgeBaseBrowser'
import TicketStatusPanel from './TicketStatusPanel'

type Tab = 'chat' | 'articles' | 'tickets'

export default function HelpWidget() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('chat')

  // Only show for authenticated users
  if (!user) return null

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-vc-purple text-white rounded-full shadow-glow-lg flex items-center justify-center hover:scale-105 transition-transform"
          title="Get help"
        >
          <HelpCircle className="w-6 h-6" />
        </button>
      )}

      {/* Expanded panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[520px] glass-card border border-white/10 rounded-2xl shadow-cosmic flex flex-col overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-semibold">Help & Support</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10">
            {([
              { id: 'chat' as Tab, label: 'Ask AI', Icon: Bot },
              { id: 'articles' as Tab, label: 'Help Articles', Icon: BookOpen },
              { id: 'tickets' as Tab, label: 'My Tickets', Icon: Ticket },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
                  activeTab === tab.id
                    ? 'text-white border-b-2 border-vc-purple'
                    : 'text-white/40 hover:text-white/60',
                )}
              >
                <tab.Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' && (
              <SupportChatPanel onTicketCreated={() => setActiveTab('tickets')} />
            )}
            {activeTab === 'articles' && <KnowledgeBaseBrowser />}
            {activeTab === 'tickets' && <TicketStatusPanel />}
          </div>
        </div>
      )}
    </>
  )
}
