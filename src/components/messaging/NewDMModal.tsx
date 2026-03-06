'use client'

import { useState, useEffect } from 'react'
import { X, User, Search } from 'lucide-react'

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

export default function NewDMModal({ onClose, onCreated }: Props) {
  const [members, setMembers] = useState<CampaignMember[]>([])
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/messaging/teammates')
        if (res.ok) {
          const data = await res.json()
          setMembers(data.teammates || [])
        }
      } catch {
        // silent
      }
    }
    load()
  }, [])

  const filtered = search
    ? members.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase())
      )
    : members

  const startDM = async (userId: string) => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const res = await fetch('/api/messaging/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        const data = await res.json()
        onCreated(data.channelId)
      }
    } catch {
      // silent
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-vc-bg border border-white/10 rounded-2xl w-full max-w-md mx-4 max-h-[70vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">New Message</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search people..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
          {filtered.length === 0 && (
            <p className="text-sm text-white/30 text-center py-4">No people found</p>
          )}
          {filtered.map(m => (
            <button
              key={m.userId}
              onClick={() => startDM(m.userId)}
              disabled={isCreating}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-white">
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
    </div>
  )
}
