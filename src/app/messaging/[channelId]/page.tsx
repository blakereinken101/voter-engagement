'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { ArrowLeft, Send, Hash, Megaphone, User, Settings, Users } from 'lucide-react'
import type { MessagingMessage, MessagingChannel } from '@/types'

export default function ChannelPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const channelId = params.channelId as string

  const [channel, setChannel] = useState<MessagingChannel | null>(null)
  const [messages, setMessages] = useState<MessagingMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Fetch channel details
  useEffect(() => {
    async function load() {
      try {
        const [channelRes, messagesRes] = await Promise.all([
          fetch(`/api/messaging/channels/${channelId}`),
          fetch(`/api/messaging/channels/${channelId}/messages?limit=50`),
        ])

        if (channelRes.ok) {
          const data = await channelRes.json()
          setChannel(data.channel)
        }
        if (messagesRes.ok) {
          const data = await messagesRes.json()
          setMessages(data.messages)
          setHasMore(data.hasMore)
        }
      } catch {
        // silent
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [channelId])

  // Mark as read on mount and when new messages arrive
  useEffect(() => {
    if (channelId) {
      fetch(`/api/messaging/channels/${channelId}/read`, { method: 'PUT' }).catch(() => {})
    }
  }, [channelId, messages.length])

  // SSE connection for real-time messages
  useEffect(() => {
    const es = new EventSource('/api/messaging/stream')
    eventSourceRef.current = es

    es.addEventListener('new_message', (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.channelId === channelId) {
          setMessages(prev => {
            // Deduplicate
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        }
      } catch {
        // bad parse
      }
    })

    es.onerror = () => {
      // Will auto-reconnect
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [channelId])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMore = useCallback(async () => {
    if (!hasMore || messages.length === 0) return
    const cursor = messages[0].createdAt
    const res = await fetch(`/api/messaging/channels/${channelId}/messages?limit=50&cursor=${cursor}`)
    if (res.ok) {
      const data = await res.json()
      setMessages(prev => [...data.messages, ...prev])
      setHasMore(data.hasMore)
    }
  }, [channelId, hasMore, messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isSending) return

    setIsSending(true)
    setInput('')

    try {
      const res = await fetch(`/api/messaging/channels/${channelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev
          return [...prev, data.message]
        })
      }
    } catch {
      setInput(text) // Restore on error
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  // Group messages by sender to collapse sequential messages
  const groupMessages = (msgs: MessagingMessage[]) => {
    const groups: { senderId: string; senderName: string; messages: MessagingMessage[]; startTime: string }[] = []
    for (const msg of msgs) {
      const last = groups[groups.length - 1]
      const timeDiff = last
        ? new Date(msg.createdAt).getTime() - new Date(last.messages[last.messages.length - 1].createdAt).getTime()
        : Infinity
      if (last && last.senderId === msg.senderId && timeDiff < 5 * 60 * 1000 && msg.messageType === 'text') {
        last.messages.push(msg)
      } else {
        groups.push({
          senderId: msg.senderId,
          senderName: msg.senderName || 'Unknown',
          messages: [msg],
          startTime: msg.createdAt,
        })
      }
    }
    return groups
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <div className="animate-pulse text-white/40">Loading...</div>
      </div>
    )
  }

  const channelIcon = channel?.channelType === 'broadcast'
    ? <Megaphone className="w-5 h-5 text-amber-400" />
    : channel?.channelType === 'direct'
      ? <User className="w-5 h-5 text-blue-400" />
      : <Hash className="w-5 h-5 text-vc-purple-light" />

  const groups = groupMessages(messages)

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Channel header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-vc-bg/50">
        <button
          onClick={() => router.push('/messaging')}
          className="text-white/50 hover:text-white transition-colors sm:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => router.push('/messaging')}
          className="text-white/50 hover:text-white transition-colors hidden sm:block"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {channelIcon}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white truncate">
            {channel?.name || 'Channel'}
          </h2>
          {channel?.description && (
            <p className="text-xs text-white/40 truncate">{channel.description}</p>
          )}
        </div>
        {channel?.channelType !== 'direct' && (
          <div className="flex items-center gap-1 text-white/30 text-xs">
            <Users className="w-3.5 h-3.5" />
            {channel?.members?.length || 0}
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {hasMore && (
          <button
            onClick={loadMore}
            className="w-full text-center text-xs text-blue-400 hover:text-blue-300 py-2"
          >
            Load older messages
          </button>
        )}

        {messages.length === 0 && (
          <div className="text-center py-16 text-white/30">
            <MessageBubbleEmpty />
            <p className="text-sm mt-4">No messages yet. Say something!</p>
          </div>
        )}

        {groups.map((group, gi) => (
          <div key={gi} className="flex gap-3">
            <div className="flex-shrink-0 mt-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                group.senderId === user?.id ? 'bg-blue-500/30 ring-1 ring-blue-500/50' : 'bg-white/10 ring-1 ring-white/20'
              }`}>
                {group.senderName.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className={`text-sm font-semibold ${group.senderId === user?.id ? 'text-blue-400' : 'text-white/80'}`}>
                  {group.senderId === user?.id ? 'You' : group.senderName}
                </span>
                <span className="text-[10px] text-white/25">{formatTime(group.startTime)}</span>
              </div>
              {group.messages.map(msg => (
                <div key={msg.id} className="mb-1">
                  {msg.messageType === 'system' ? (
                    <p className="text-xs text-white/30 italic">
                      {msg.senderName} {msg.content}
                    </p>
                  ) : msg.messageType === 'announcement' ? (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      <p className="text-sm text-white/90">{msg.isDeleted ? 'This message was deleted' : msg.content}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-white/80 whitespace-pre-wrap break-words">
                      {msg.isDeleted ? (
                        <span className="italic text-white/30">This message was deleted</span>
                      ) : msg.content}
                      {msg.isEdited && !msg.isDeleted && (
                        <span className="text-[10px] text-white/20 ml-1">(edited)</span>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-white/10 px-4 py-3 bg-vc-bg/50">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${channel?.name || 'channel'}...`}
            rows={1}
            className="flex-1 resize-none bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 max-h-32"
            style={{ minHeight: '2.5rem' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isSending}
            className="flex-shrink-0 p-2 rounded-lg bg-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageBubbleEmpty() {
  return (
    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mx-auto flex items-center justify-center">
      <Send className="w-6 h-6 text-white/20" />
    </div>
  )
}
