'use client'

import { UserPlus, Search, MessageCircle, CheckCircle, ShieldCheck, ShieldX } from 'lucide-react'
import type { ChatMessage } from '@/types'

function ToolResultChip({ name, result }: { name: string; result: Record<string, unknown> }) {
  const icons: Record<string, React.ReactNode> = {
    add_contact: <UserPlus className="w-3 h-3" />,
    run_matching: <Search className="w-3 h-3" />,
    log_conversation: <MessageCircle className="w-3 h-3" />,
    get_next_contact: <CheckCircle className="w-3 h-3" />,
    update_match_status: result.status === 'confirmed'
      ? <ShieldCheck className="w-3 h-3" />
      : <ShieldX className="w-3 h-3" />,
  }

  const labels: Record<string, string> = {
    add_contact: result.contact
      ? `Added ${(result.contact as Record<string, string>).firstName} ${(result.contact as Record<string, string>).lastName}`
      : 'Added contact',
    run_matching: result.matched !== undefined
      ? `Matched ${result.matched} of ${result.total} to voter file`
      : 'Ran voter file matching',
    log_conversation: `Logged: ${result.outcome || 'conversation'}`,
    get_next_contact: result.name ? `Next: ${result.name}` : 'Checked contacts',
    get_contact_details: 'Looked up contact',
    get_contacts_summary: 'Checked summary',
    update_match_status: result.status === 'confirmed' ? 'Voter file match confirmed' : 'Voter file match rejected',
  }

  // Different colors for different actions
  const colorClasses: Record<string, string> = {
    add_contact: 'bg-blue-500/20 text-blue-300',
    run_matching: 'bg-vc-teal/20 text-vc-teal',
    log_conversation: 'bg-amber-500/20 text-amber-300',
    get_next_contact: 'bg-vc-purple/20 text-vc-purple-light',
    get_contact_details: 'bg-white/10 text-white/60',
    get_contacts_summary: 'bg-white/10 text-white/60',
    update_match_status: result.status === 'confirmed'
      ? 'bg-green-500/20 text-green-300'
      : 'bg-red-500/20 text-red-300',
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mr-1 mb-1 ${colorClasses[name] || 'bg-white/10 text-white/60'}`}>
      {icons[name] || <CheckCircle className="w-3 h-3" />}
      {labels[name] || name}
    </span>
  )
}

interface ChatMessageBubbleProps {
  message: ChatMessage
  isStreaming?: boolean
}

export default function ChatMessageBubble({ message, isStreaming }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-vc-purple/30 border border-vc-purple/50 text-white'
            : 'glass-card text-white/90'
        }`}
      >
        {/* Tool result chips */}
        {message.toolResults && message.toolResults.length > 0 && (
          <div className="flex flex-wrap mb-2">
            {message.toolResults.map((tr, i) => (
              <ToolResultChip key={i} name={tr.name} result={tr.result} />
            ))}
          </div>
        )}

        {/* Message content */}
        <div className="text-base leading-relaxed whitespace-pre-wrap">
          {message.content}
          {isStreaming && !message.content && (
            <span className="inline-flex gap-1 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
