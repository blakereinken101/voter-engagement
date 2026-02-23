'use client'

import { Users, MessageCircle, Plus, ArrowRight } from 'lucide-react'

interface ChatQuickActionsProps {
  onSend: (message: string) => void
  contactCount: number
  contactedCount: number
  disabled?: boolean
}

export default function ChatQuickActions({ onSend, contactCount, contactedCount, disabled }: ChatQuickActionsProps) {
  const hasContacts = contactCount > 0
  const hasEnoughContacts = contactCount >= 40
  const allContacted = hasContacts && contactedCount >= contactCount

  const actions: { label: string; message: string; icon: React.ReactNode }[] = []

  if (!hasContacts) {
    actions.push({
      label: "Let's get started",
      message: "I'm ready to start building my contact list!",
      icon: <ArrowRight className="w-3.5 h-3.5" />,
    })
  } else if (!hasEnoughContacts) {
    actions.push({
      label: 'Add more people',
      message: "Let's keep adding people to my list.",
      icon: <Plus className="w-3.5 h-3.5" />,
    })
    if (contactCount >= 10) {
      actions.push({
        label: 'Start conversations',
        message: "I'd like to start reaching out to some people on my list.",
        icon: <MessageCircle className="w-3.5 h-3.5" />,
      })
    }
  } else {
    actions.push({
      label: 'Who should I talk to?',
      message: 'Who should I talk to next?',
      icon: <MessageCircle className="w-3.5 h-3.5" />,
    })
    actions.push({
      label: 'Add more people',
      message: "I want to add more people to my list.",
      icon: <Plus className="w-3.5 h-3.5" />,
    })
  }

  if (allContacted && hasContacts) {
    actions.push({
      label: 'See my progress',
      message: 'Can you give me a summary of how my outreach is going?',
      icon: <Users className="w-3.5 h-3.5" />,
    })
  }

  if (actions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={() => onSend(action.message)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs font-bold text-white/70 hover:text-white hover:border-white/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  )
}
