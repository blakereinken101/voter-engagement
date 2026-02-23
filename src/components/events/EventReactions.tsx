'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { DEFAULT_REACTION_EMOJIS } from '@/types/events'
import type { ReactionSummary } from '@/types/events'

interface Props {
  eventId: string
}

export default function EventReactions({ eventId }: Props) {
  const { user } = useAuth()
  const [reactions, setReactions] = useState<ReactionSummary[]>([])

  useEffect(() => {
    fetch(`/api/events/${eventId}/reactions`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.reactions) setReactions(data.reactions)
      })
      .catch(() => {})
  }, [eventId])

  async function toggleReaction(emoji: string) {
    if (!user) return

    // Optimistic update
    setReactions(prev => {
      const existing = prev.find(r => r.emoji === emoji)
      if (existing) {
        if (existing.userReacted) {
          const newCount = existing.count - 1
          return newCount <= 0
            ? prev.filter(r => r.emoji !== emoji)
            : prev.map(r => r.emoji === emoji ? { ...r, count: newCount, userReacted: false } : r)
        } else {
          return prev.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, userReacted: true } : r)
        }
      } else {
        return [...prev, { emoji, count: 1, userReacted: true }]
      }
    })

    try {
      await fetch(`/api/events/${eventId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
    } catch {
      // Revert on error by refetching
      const res = await fetch(`/api/events/${eventId}/reactions`)
      if (res.ok) {
        const data = await res.json()
        setReactions(data.reactions || [])
      }
    }
  }

  // Merge existing reactions with default emojis
  const allEmojis = [...new Set([
    ...reactions.map(r => r.emoji),
    ...DEFAULT_REACTION_EMOJIS,
  ])]

  return (
    <div className="flex flex-wrap gap-2">
      {allEmojis.map(emoji => {
        const reaction = reactions.find(r => r.emoji === emoji)
        const count = reaction?.count || 0
        const userReacted = reaction?.userReacted || false

        return (
          <button
            key={emoji}
            onClick={() => toggleReaction(emoji)}
            disabled={!user}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
              userReacted
                ? 'bg-vc-purple/20 border border-vc-purple/40 text-white'
                : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
            } ${!user ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
            title={!user ? 'Sign in to react' : undefined}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="text-xs font-medium">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
