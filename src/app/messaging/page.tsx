'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { MessageCircle, Plus, Hash, Megaphone, User, Search } from 'lucide-react'
import CreateChannelModal from '@/components/messaging/CreateChannelModal'
import NewDMModal from '@/components/messaging/NewDMModal'
import type { MessagingChannel } from '@/types'

export default function MessagingPage() {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [channels, setChannels] = useState<MessagingChannel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showNewDM, setShowNewDM] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/messaging/channels')
      if (res.ok) {
        const data = await res.json()
        setChannels(data.channels)
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChannels()
    // Poll for updates every 30s
    const interval = setInterval(fetchChannels, 30000)
    return () => clearInterval(interval)
  }, [fetchChannels])

  const teamChannels = channels.filter(c => c.channelType === 'team')
  const broadcastChannels = channels.filter(c => c.channelType === 'broadcast')
  const dmChannels = channels.filter(c => c.channelType === 'direct')

  const filtered = (list: MessagingChannel[]) =>
    searchQuery
      ? list.filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
      : list

  const totalUnread = channels.reduce((sum, c) => sum + (c.unreadCount || 0), 0)

  const ChannelRow = ({ channel }: { channel: MessagingChannel }) => (
    <button
      onClick={() => router.push(`/messaging/${channel.id}`)}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors text-left group"
    >
      <div className="flex-shrink-0">
        {channel.channelType === 'direct' ? (
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-400" />
          </div>
        ) : channel.channelType === 'broadcast' ? (
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-amber-400" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-vc-purple/20 flex items-center justify-center">
            <Hash className="w-5 h-5 text-vc-purple-light" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${(channel.unreadCount || 0) > 0 ? 'text-white' : 'text-white/70'}`}>
            {channel.name || 'Unnamed'}
          </span>
          {channel.memberCount && channel.channelType !== 'direct' && (
            <span className="text-xs text-white/30">{channel.memberCount}</span>
          )}
        </div>
        {channel.lastMessage && (
          <p className="text-xs text-white/40 truncate mt-0.5">
            <span className="text-white/50">{channel.lastMessage.senderName}:</span>{' '}
            {channel.lastMessage.content}
          </p>
        )}
      </div>

      {(channel.unreadCount || 0) > 0 && (
        <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-[11px] font-bold text-white">
          {channel.unreadCount! > 9 ? '9+' : channel.unreadCount}
        </span>
      )}
    </button>
  )

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="animate-pulse text-white/40">Loading messages...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Messages</h1>
          {totalUnread > 0 && (
            <p className="text-sm text-blue-400">{totalUnread} unread</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewDM(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <User className="w-4 h-4" />
            New DM
          </button>
          {(isAdmin || true) && ( // Any organizer+ can create — checked server-side
            <button
              onClick={() => setShowCreateChannel(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Channel
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {channels.length > 5 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      )}

      {/* Empty state */}
      {channels.length === 0 && (
        <div className="text-center py-16 glass-card rounded-2xl">
          <MessageCircle className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">No messages yet</h2>
          <p className="text-sm text-white/50 mb-6">Create a channel to start communicating with your team.</p>
          <button
            onClick={() => setShowCreateChannel(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-btn bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Channel
          </button>
        </div>
      )}

      {/* Broadcast channels */}
      {filtered(broadcastChannels).length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-2 px-4">Announcements</h2>
          <div className="space-y-1">
            {filtered(broadcastChannels).map(c => <ChannelRow key={c.id} channel={c} />)}
          </div>
        </div>
      )}

      {/* Team channels */}
      {filtered(teamChannels).length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-2 px-4">Team Channels</h2>
          <div className="space-y-1">
            {filtered(teamChannels).map(c => <ChannelRow key={c.id} channel={c} />)}
          </div>
        </div>
      )}

      {/* DMs */}
      {filtered(dmChannels).length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-2 px-4">Direct Messages</h2>
          <div className="space-y-1">
            {filtered(dmChannels).map(c => <ChannelRow key={c.id} channel={c} />)}
          </div>
        </div>
      )}

      {showCreateChannel && (
        <CreateChannelModal
          onClose={() => setShowCreateChannel(false)}
          onCreated={(channelId) => {
            setShowCreateChannel(false)
            router.push(`/messaging/${channelId}`)
          }}
        />
      )}

      {showNewDM && (
        <NewDMModal
          onClose={() => setShowNewDM(false)}
          onCreated={(channelId) => {
            setShowNewDM(false)
            router.push(`/messaging/${channelId}`)
          }}
        />
      )}
    </div>
  )
}
