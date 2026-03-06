'use client'

import { useState, useEffect } from 'react'
import { X, Hash } from 'lucide-react'

interface Props {
  onClose: () => void
  onCreated: (channelId: string) => void
}

interface CampaignMember {
  userId: string
  name: string
  email: string
  role: string
}

export default function CreateChannelModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [members, setMembers] = useState<CampaignMember[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Fetch campaign members
    async function load() {
      try {
        const res = await fetch('/api/admin/volunteers')
        if (res.ok) {
          const data = await res.json()
          setMembers(data.volunteers?.map((v: { id: string; name: string; email: string; role: string }) => ({
            userId: v.id,
            name: v.name,
            email: v.email,
            role: v.role,
          })) || [])
        }
      } catch {
        // silent
      }
    }
    load()
  }, [])

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const create = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setIsCreating(true)
    setError('')

    try {
      const res = await fetch('/api/messaging/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          memberIds: Array.from(selectedIds),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        onCreated(data.channelId)
      } else {
        const data = await res.json().catch(() => ({ error: 'Failed to create channel' }))
        setError(data.error)
      }
    } catch {
      setError('Network error')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-vc-bg border border-white/10 rounded-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-vc-purple-light" />
            <h2 className="text-lg font-semibold text-white">New Channel</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">Channel Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. neighborhood-captains"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {members.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Add Members ({selectedIds.size} selected)
              </label>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {members.map(m => (
                  <button
                    key={m.userId}
                    onClick={() => toggle(m.userId)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      selectedIds.has(m.userId) ? 'bg-blue-500/20 border border-blue-500/30' : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-white/80 truncate block">{m.name}</span>
                      <span className="text-xs text-white/30">{m.role}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-btn text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={isCreating || !name.trim()}
            className="px-4 py-2 rounded-btn text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors"
          >
            {isCreating ? 'Creating...' : 'Create Channel'}
          </button>
        </div>
      </div>
    </div>
  )
}
