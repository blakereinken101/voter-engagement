'use client'

import { useState, useEffect } from 'react'
import { ActivityLogEntry } from '@/types'

const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
  sign_up: { icon: '🎉', color: 'bg-rally-green/10 text-rally-green' },
  sign_in: { icon: '🔑', color: 'bg-gray-100 text-gray-500' },
  add_contact: { icon: '➕', color: 'bg-rally-green/10 text-rally-green' },
  remove_contact: { icon: '🗑️', color: 'bg-rally-red/10 text-rally-red' },
  confirm_match: { icon: '✅', color: 'bg-rally-yellow/10 text-rally-yellow' },
  reject_match: { icon: '❌', color: 'bg-rally-red/10 text-rally-red' },
  mark_contacted: { icon: '📞', color: 'bg-rally-navy/5 text-rally-navy' },
  record_outcome: { icon: '📝', color: 'bg-rally-green/10 text-rally-green' },
}

function formatAction(action: string, details: string | null): string {
  const d = details ? JSON.parse(details) : {}
  switch (action) {
    case 'sign_up': return 'created an account'
    case 'sign_in': return 'signed in'
    case 'add_contact': return `added contact ${d.name || ''}`
    case 'remove_contact': return 'removed a contact'
    case 'confirm_match': return 'confirmed a match'
    case 'reject_match': return 'rejected a match'
    case 'mark_contacted': return `contacted someone via ${d.method || 'unknown'}`
    case 'record_outcome': return `recorded outcome: ${d.outcome || 'unknown'}`
    default: return action
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const d = new Date(dateStr + 'Z')
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function ActivityTimeline() {
  const [activities, setActivities] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/activity?limit=100')
      .then(res => res.json())
      .then(data => setActivities(data.activities || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-12 text-rally-slate-light">Loading activity...</div>

  return (
    <div className="max-w-2xl">
      {activities.length === 0 ? (
        <div className="text-center py-12 text-rally-slate-light">No activity yet</div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

          <div className="space-y-1">
            {activities.map(activity => {
              const ai = ACTION_ICONS[activity.action] || { icon: '•', color: 'bg-gray-100 text-gray-500' }
              return (
                <div key={activity.id} className="flex items-start gap-3 py-2.5 pl-1 relative">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0 z-10 ${ai.color}`}>
                    {ai.icon}
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <p className="text-sm">
                      <span className="font-medium">{activity.userName}</span>{' '}
                      <span className="text-rally-slate-light">{formatAction(activity.action, activity.details)}</span>
                    </p>
                    <p className="text-[10px] text-rally-slate-light/60 font-mono mt-0.5">
                      {timeAgo(activity.createdAt)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
