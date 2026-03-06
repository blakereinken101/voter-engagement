'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageCircle, Plus, Users, Hash, Megaphone, Archive, UserMinus, UserPlus, ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

interface AdminChannel {
  id: string
  name: string | null
  channelType: string
  description: string | null
  isArchived: boolean
  createdAt: string
  createdByName: string
  memberCount: number
  messageCount: number
  lastActivity: string | null
}

interface ChannelMember {
  id: string
  userId: string
  name: string
  email: string
  channelRole: string
  campaignRole: string
  joinedAt: string
}

interface CampaignMember {
  id: string
  name: string
  email: string
  role: string
}

const TYPE_ICONS: Record<string, typeof Hash> = {
  team: Hash,
  broadcast: Megaphone,
  direct: Users,
}

const TYPE_LABELS: Record<string, string> = {
  team: 'Team',
  broadcast: 'Broadcast',
  direct: 'DM',
}

export default function ChannelManagement() {
  const [channels, setChannels] = useState<AdminChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  // Create form
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [campaignMembers, setCampaignMembers] = useState<CampaignMember[]>([])
  const [selectedOrganizer, setSelectedOrganizer] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)

  // Add members
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [addMemberIds, setAddMemberIds] = useState<Set<string>>(new Set())

  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/messaging/channels')
      if (res.ok) {
        const data = await res.json()
        setChannels(data.channels || [])
      }
    } catch {
      setError('Failed to load channels')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadChannels() }, [loadChannels])

  async function loadMembers(channelId: string) {
    setMembersLoading(true)
    try {
      const res = await fetch(`/api/admin/messaging/channels/${channelId}`)
      if (res.ok) {
        const data = await res.json()
        setChannelMembers(data.members || [])
      }
    } catch { /* silent */ }
    setMembersLoading(false)
  }

  async function loadCampaignMembers() {
    try {
      const res = await fetch('/api/admin/volunteers')
      if (res.ok) {
        const data = await res.json()
        setCampaignMembers((data.volunteers || []).map((v: { id: string; name: string; email: string }) => ({
          id: v.id, name: v.name, email: v.email, role: 'volunteer',
        })))
      }
    } catch { /* silent */ }
  }

  function toggleExpand(channelId: string) {
    if (expandedId === channelId) {
      setExpandedId(null)
      setShowAddMembers(false)
    } else {
      setExpandedId(channelId)
      setShowAddMembers(false)
      setAddMemberIds(new Set())
      loadMembers(channelId)
    }
  }

  async function createChannel(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/admin/messaging/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          organizerId: selectedOrganizer || undefined,
          memberIds: [...selectedMembers],
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create channel')
      }
      setShowCreate(false)
      setNewName('')
      setNewDesc('')
      setSelectedOrganizer('')
      setSelectedMembers(new Set())
      await loadChannels()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create channel')
    } finally {
      setCreating(false)
    }
  }

  async function removeMember(channelId: string, userId: string) {
    try {
      await fetch(`/api/admin/messaging/channels/${channelId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      setChannelMembers(prev => prev.filter(m => m.userId !== userId))
      setChannels(prev => prev.map(c =>
        c.id === channelId ? { ...c, memberCount: c.memberCount - 1 } : c
      ))
    } catch {
      setError('Failed to remove member')
    }
  }

  async function addMembers(channelId: string) {
    if (addMemberIds.size === 0) return
    try {
      await fetch(`/api/admin/messaging/channels/${channelId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [...addMemberIds] }),
      })
      setShowAddMembers(false)
      setAddMemberIds(new Set())
      await loadMembers(channelId)
      await loadChannels()
    } catch {
      setError('Failed to add members')
    }
  }

  async function archiveChannel(channelId: string, archive: boolean) {
    try {
      await fetch(`/api/admin/messaging/channels/${channelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: archive }),
      })
      setChannels(prev => prev.map(c =>
        c.id === channelId ? { ...c, isArchived: archive } : c
      ))
    } catch {
      setError('Failed to update channel')
    }
  }

  if (loading) return <div className="text-center py-12 text-white/50">Loading channels...</div>

  const activeChannels = channels.filter(c => !c.isArchived)
  const archivedChannels = channels.filter(c => c.isArchived)

  // Members not already in the expanded channel
  const existingMemberIds = new Set(channelMembers.map(m => m.userId))
  const availableToAdd = campaignMembers.filter(m => !existingMemberIds.has(m.id))

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/20 text-red-300 text-sm px-4 py-3 rounded-lg border border-red-500/30">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-400" />
          Channels ({activeChannels.length})
        </h3>
        <button
          onClick={() => { setShowCreate(!showCreate); if (!showCreate) loadCampaignMembers() }}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-btn text-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Channel
        </button>
      </div>

      {/* Create channel form */}
      {showCreate && (
        <form onSubmit={createChannel} className="glass-card p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-1">Channel Name</label>
            <input
              type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Downtown Team" required
              className="glass-input w-full rounded-btn h-10 px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-1">Description (optional)</label>
            <input
              type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="What is this channel for?"
              className="glass-input w-full rounded-btn h-10 px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-1">Organizer (channel admin)</label>
            <select
              value={selectedOrganizer} onChange={e => setSelectedOrganizer(e.target.value)}
              className="glass-input w-full rounded-btn h-10 px-3 text-sm bg-transparent"
            >
              <option value="" className="bg-vc-bg">None (you&apos;ll be admin)</option>
              {campaignMembers.map(m => (
                <option key={m.id} value={m.id} className="bg-vc-bg">{m.name} ({m.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-1">
              Members ({selectedMembers.size} selected)
            </label>
            <div className="max-h-40 overflow-y-auto space-y-1 glass p-2 rounded-lg">
              {campaignMembers.filter(m => m.id !== selectedOrganizer).map(m => (
                <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(m.id)}
                    onChange={e => {
                      const next = new Set(selectedMembers)
                      e.target.checked ? next.add(m.id) : next.delete(m.id)
                      setSelectedMembers(next)
                    }}
                    className="rounded border-white/20"
                  />
                  <span className="text-sm text-white/80">{m.name}</span>
                  <span className="text-xs text-white/30 ml-auto">{m.email}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit" disabled={creating}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2.5 rounded-btn text-sm transition-all disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Team Channel'}
          </button>
        </form>
      )}

      {/* Channel list */}
      <div className="space-y-2">
        {activeChannels.map(ch => {
          const Icon = TYPE_ICONS[ch.channelType] || Hash
          const isExpanded = expandedId === ch.id
          return (
            <div key={ch.id} className="glass-card overflow-hidden">
              <button
                onClick={() => toggleExpand(ch.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
              >
                <div className={clsx(
                  'w-9 h-9 rounded-full flex items-center justify-center',
                  ch.channelType === 'broadcast' ? 'bg-orange-500/15' :
                  ch.channelType === 'direct' ? 'bg-blue-500/15' : 'bg-vc-purple/15'
                )}>
                  <Icon className={clsx('w-4 h-4',
                    ch.channelType === 'broadcast' ? 'text-orange-400' :
                    ch.channelType === 'direct' ? 'text-blue-400' : 'text-vc-purple-light'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">
                      {ch.name || 'Direct Message'}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">
                      {TYPE_LABELS[ch.channelType]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-white/40">{ch.memberCount} members</span>
                    <span className="text-xs text-white/40">{ch.messageCount} messages</span>
                    {ch.lastActivity && (
                      <span className="text-xs text-white/30">
                        Last active {new Date(ch.lastActivity).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                {isExpanded ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronRight className="w-4 h-4 text-white/30" />}
              </button>

              {/* Expanded: members + actions */}
              {isExpanded && (
                <div className="border-t border-white/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white/60">Members</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowAddMembers(!showAddMembers); if (!showAddMembers) loadCampaignMembers() }}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Add
                      </button>
                      <button
                        onClick={() => archiveChannel(ch.id, true)}
                        className="flex items-center gap-1 text-xs text-white/30 hover:text-red-400"
                      >
                        <Archive className="w-3.5 h-3.5" /> Archive
                      </button>
                    </div>
                  </div>

                  {/* Add members dropdown */}
                  {showAddMembers && (
                    <div className="glass p-3 rounded-lg space-y-2">
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {availableToAdd.length === 0 && (
                          <p className="text-xs text-white/30 py-2 text-center">All members are already in this channel</p>
                        )}
                        {availableToAdd.map(m => (
                          <label key={m.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={addMemberIds.has(m.id)}
                              onChange={e => {
                                const next = new Set(addMemberIds)
                                e.target.checked ? next.add(m.id) : next.delete(m.id)
                                setAddMemberIds(next)
                              }}
                              className="rounded border-white/20"
                            />
                            <span className="text-xs text-white/70">{m.name}</span>
                            <span className="text-xs text-white/30 ml-auto">{m.email}</span>
                          </label>
                        ))}
                      </div>
                      {addMemberIds.size > 0 && (
                        <button
                          onClick={() => addMembers(ch.id)}
                          className="w-full text-xs bg-blue-500/20 text-blue-400 py-1.5 rounded-btn font-semibold hover:bg-blue-500/30"
                        >
                          Add {addMemberIds.size} member{addMemberIds.size !== 1 ? 's' : ''}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Member list */}
                  {membersLoading ? (
                    <div className="text-center py-4 text-white/30 text-xs">Loading...</div>
                  ) : (
                    <div className="space-y-1">
                      {channelMembers.map(m => (
                        <div key={m.userId} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white/5">
                          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-white/80 truncate block">{m.name}</span>
                            <span className="text-xs text-white/30">{m.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {m.channelRole === 'admin' && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">admin</span>
                            )}
                            {m.campaignRole && m.campaignRole !== 'volunteer' && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-vc-purple/20 text-vc-purple-light">{m.campaignRole}</span>
                            )}
                            <button
                              onClick={() => removeMember(ch.id, m.userId)}
                              className="p-1 text-white/20 hover:text-red-400 transition-colors"
                              title="Remove from channel"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Archived channels */}
      {archivedChannels.length > 0 && (
        <details className="group">
          <summary className="text-sm font-bold text-white/40 cursor-pointer hover:text-white/60 transition-colors mb-2">
            Archived Channels ({archivedChannels.length})
          </summary>
          <div className="space-y-2">
            {archivedChannels.map(ch => (
              <div key={ch.id} className="glass-card p-3 opacity-60 flex items-center justify-between">
                <div>
                  <span className="text-sm text-white/50">{ch.name || 'DM'}</span>
                  <span className="text-xs text-white/30 ml-2">{ch.memberCount} members</span>
                </div>
                <button
                  onClick={() => archiveChannel(ch.id, false)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Unarchive
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {activeChannels.length === 0 && !showCreate && (
        <div className="text-center py-12">
          <MessageCircle className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No channels yet. Create one to get started.</p>
        </div>
      )}
    </div>
  )
}
