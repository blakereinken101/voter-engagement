'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, UserPlus } from 'lucide-react'
import type { SupportChatMessage as SupportChatMsg } from '@/types'
import SupportChatMessage from './SupportChatMessage'

interface ChatEntry {
  role: 'user' | 'assistant'
  content: string
  ticketId?: string
  ticketSubject?: string
}

interface Props {
  onTicketCreated?: () => void
}

export default function SupportChatPanel({ onTicketCreated }: Props) {
  const [messages, setMessages] = useState<ChatEntry[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streaming])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: ChatEntry = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    // Build history for context
    const history: SupportChatMsg[] = messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: new Date().toISOString(),
    }))

    try {
      const res = await fetch('/api/support/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })

      if (!res.ok) {
        throw new Error('Failed to get response')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let assistantText = ''
      let ticketId: string | undefined
      let ticketSubject: string | undefined

      // Add placeholder assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const event = JSON.parse(data)
            if (event.type === 'text' && event.text) {
              assistantText += event.text
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: assistantText,
                  ticketId,
                  ticketSubject,
                }
                return updated
              })
            } else if (event.type === 'tool_result') {
              ticketId = event.ticketId
              ticketSubject = event.ticketSubject
              onTicketCreated?.()
            } else if (event.type === 'error') {
              assistantText += event.message || 'An error occurred.'
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: assistantText }
                return updated
              })
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Final update with ticket info
      if (ticketId) {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: assistantText,
            ticketId,
            ticketSubject,
          }
          return updated
        })
      }
    } catch (err) {
      console.error('[support-chat] Error:', err)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble connecting. Please try again.',
      }])
    } finally {
      setStreaming(false)
    }
  }

  const handleManualEscalate = async () => {
    if (messages.length === 0) return
    setStreaming(true)

    const history: SupportChatMsg[] = messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: new Date().toISOString(),
    }))

    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: messages[0]?.content.slice(0, 80) || 'Support request',
          category: 'general',
          priority: 'normal',
          aiConversation: history,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "I've created a support ticket for you. A team member will follow up soon.",
          ticketId: data.ticket.id,
          ticketSubject: data.ticket.subject,
        }])
        onTicketCreated?.()
      }
    } catch (err) {
      console.error('[support-chat] Manual escalate error:', err)
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-white/40 text-sm">Hi! How can I help you today?</p>
            <p className="text-white/25 text-xs mt-1">Ask me anything about Threshold</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <SupportChatMessage key={i} {...msg} />
          ))
        )}
        {streaming && messages.length > 0 && messages[messages.length - 1].content === '' && (
          <div className="flex gap-2">
            <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-vc-purple/20">
              <div className="flex gap-0.5">
                <span className="w-1 h-1 bg-vc-purple rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-vc-purple rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-vc-purple rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Talk to Human button */}
      {messages.length > 0 && (
        <div className="px-3">
          <button
            onClick={handleManualEscalate}
            disabled={streaming}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors disabled:opacity-30"
          >
            <UserPlus className="w-3 h-3" />
            Talk to a human
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }}}
            className="glass-input flex-1 px-3 py-2 rounded-full text-sm"
            placeholder="Ask a question..."
            disabled={streaming}
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className="p-2 bg-vc-purple text-white rounded-full hover:bg-vc-purple/80 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
