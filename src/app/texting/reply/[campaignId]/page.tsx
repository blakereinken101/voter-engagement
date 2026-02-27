'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, Loader2, MessageSquare, Search } from 'lucide-react'
import type { TextCampaignContact, TextMessage, TextCampaignScript } from '@/types/texting'

interface Conversation {
  contact: TextCampaignContact
  lastMessageBody: string | null
  lastMessageDirection: string | null
  lastMessageAt: string | null
  messageCount: number
}

export default function ReplyPage() {
  const { user } = useAuth()
  const params = useParams()
  const campaignId = params.campaignId as string

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedContact, setSelectedContact] = useState<TextCampaignContact | null>(null)
  const [messages, setMessages] = useState<TextMessage[]>([])
  const [cannedResponses, setCannedResponses] = useState<TextCampaignScript[]>([])
  const [replyText, setReplyText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user || !campaignId) return
    loadConversations()
    loadCannedResponses()
  }, [user, campaignId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadConversations() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/texting/campaigns/${campaignId}/review?status=replied`)
      const data = await res.json()
      setConversations(data.conversations || [])
    } finally {
      setIsLoading(false)
    }
  }

  async function loadCannedResponses() {
    const res = await fetch(`/api/texting/campaigns/${campaignId}/scripts?type=canned_response`)
    const data = await res.json()
    setCannedResponses(data.scripts || [])
  }

  async function selectConversation(contact: TextCampaignContact) {
    setSelectedContact(contact)
    const res = await fetch(`/api/texting/campaigns/${campaignId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: contact.id }),
    })
    const data = await res.json()
    setMessages(data.messages || [])
  }

  async function handleSendReply() {
    if (!selectedContact || !replyText.trim()) return
    setIsSending(true)
    try {
      const res = await fetch(`/api/texting/campaigns/${campaignId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: selectedContact.id, body: replyText.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages(data.messages || [])
        setReplyText('')
      }
    } finally {
      setIsSending(false)
    }
  }

  function useCannedResponse(script: TextCampaignScript) {
    let body = script.body
    if (selectedContact) {
      body = body
        .replace(/\{firstName\}/g, selectedContact.firstName)
        .replace(/\{lastName\}/g, selectedContact.lastName)
        .replace(/\{fullName\}/g, `${selectedContact.firstName} ${selectedContact.lastName}`)
    }
    setReplyText(body)
  }

  const filteredConversations = searchQuery
    ? conversations.filter(c =>
        `${c.contact.firstName} ${c.contact.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations

  if (isLoading) {
    return (
      <div className="min-h-screen bg-vc-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-vc-bg flex flex-col">
      <div className="border-b border-white/10 px-4 py-3">
        <Link href="/texting" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to My Texts
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <div className="w-80 border-r border-white/10 flex flex-col">
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search contacts..."
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-500/50"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-white/40 text-sm">No conversations with replies</div>
            ) : (
              filteredConversations.map(convo => (
                <button
                  key={convo.contact.id}
                  onClick={() => selectConversation(convo.contact)}
                  className={`w-full text-left p-4 border-b border-white/5 hover:bg-white/5 transition-colors ${
                    selectedContact?.id === convo.contact.id ? 'bg-white/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white text-sm">
                      {convo.contact.firstName} {convo.contact.lastName}
                    </span>
                    <span className="text-xs text-white/30">
                      {convo.messageCount} msgs
                    </span>
                  </div>
                  {convo.lastMessageBody && (
                    <p className="text-xs text-white/40 truncate">
                      {convo.lastMessageDirection === 'inbound' ? '> ' : ''}
                      {convo.lastMessageBody}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 flex flex-col">
          {!selectedContact ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/40">Select a conversation to reply</p>
              </div>
            </div>
          ) : (
            <>
              {/* Contact header */}
              <div className="border-b border-white/10 px-6 py-3">
                <div className="font-semibold text-white">{selectedContact.firstName} {selectedContact.lastName}</div>
                <div className="text-xs text-white/40">{selectedContact.cell}</div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      msg.direction === 'outbound'
                        ? 'bg-amber-500 text-black rounded-br-md'
                        : 'bg-white/10 text-white rounded-bl-md'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                      <p className={`text-[10px] mt-1 ${
                        msg.direction === 'outbound' ? 'text-black/40' : 'text-white/30'
                      }`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Canned responses */}
              {cannedResponses.length > 0 && (
                <div className="border-t border-white/10 px-4 py-2 flex gap-2 overflow-x-auto">
                  {cannedResponses.map(cr => (
                    <button
                      key={cr.id}
                      onClick={() => useCannedResponse(cr)}
                      className="flex-shrink-0 px-3 py-1 text-xs bg-white/5 text-white/60 border border-white/10 rounded-full hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
                    >
                      {cr.title || cr.body.slice(0, 30)}
                    </button>
                  ))}
                </div>
              )}

              {/* Reply input */}
              <div className="border-t border-white/10 p-4">
                <div className="flex gap-3">
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    rows={2}
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 outline-none focus:border-amber-500/50 resize-none text-sm"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendReply()
                      }
                    }}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={isSending || !replyText.trim()}
                    className="px-4 bg-amber-500 text-black rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors self-end"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
