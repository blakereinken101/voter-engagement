'use client'

import { User, Bot } from 'lucide-react'

interface Props {
  role: 'user' | 'assistant'
  content: string
  ticketId?: string
  ticketSubject?: string
}

export default function SupportChatMessage({ role, content, ticketId, ticketSubject }: Props) {
  const isUser = role === 'user'

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
        isUser ? 'bg-vc-teal/20' : 'bg-vc-purple/20'
      }`}>
        {isUser ? <User className="w-3.5 h-3.5 text-vc-teal" /> : <Bot className="w-3.5 h-3.5 text-vc-purple" />}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
        isUser
          ? 'bg-vc-teal/15 text-white'
          : 'bg-white/5 text-white/80'
      }`}>
        <p className="whitespace-pre-wrap">{content}</p>
        {ticketId && (
          <div className="mt-2 px-2 py-1.5 rounded-lg bg-vc-purple/10 border border-vc-purple/20">
            <p className="text-xs text-vc-purple font-medium">
              Ticket created: {ticketSubject || ticketId}
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              A support agent will get back to you soon.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
