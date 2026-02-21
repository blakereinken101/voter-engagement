'use client'

import { useState, useEffect } from 'react'
import { ActivityLogEntry } from '@/types'
import { UserPlus, LogIn, Plus, Trash2, CheckCircle, XCircle, Phone, FileText, Circle } from 'lucide-react'

const ACTION_ICONS: Record<string, { Icon: typeof UserPlus; color: string }> = {
  sign_up: { Icon: UserPlus, color: 'bg-vc-teal/10 text-vc-teal' },
  sign_in: { Icon: LogIn, color: 'bg-white/10 text-white/50' },
  add_contact: { Icon: Plus, color: 'bg-vc-teal/10 text-vc-teal' },
  remove_contact: { Icon: Trash2, color: 'bg-vc-coral/10 text-vc-coral' },
  confirm_match: { Icon: CheckCircle, color: 'bg-vc-gold/10 text-vc-gold' },
  reject_match: { Icon: XCircle, color: 'bg-vc-coral/10 text-vc-coral' },
  mark_contacted: { Icon: Phone, color: 'bg-vc-purple/5 text-vc-purple' },
  record_outcome: { Icon: FileText, color: 'bg-vc-teal/10 text-vc-teal' },
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

  if (loading) return <div className="text-center py-12 text-white/50">Loading activity...</div>

  return (
    <div className="max-w-2xl">
      {activities.length === 0 ? (
        <div className="text-center py-12 text-white/50">No activity yet</div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-white/10" />

          <div className="space-y-1">
            {activities.map(activity => {
              const ai = ACTION_ICONS[activity.action] || { Icon: Circle, color: 'bg-white/10 text-white/50' }
              const IconComp = ai.Icon
              return (
                <div key={activity.id} className="flex items-start gap-3 py-2.5 pl-1 relative">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${ai.color}`}>
                    <IconComp className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <p className="text-sm">
                      <span className="font-medium text-vc-purple-light">{activity.userName}</span>{' '}
                      <span className="text-white/50">{formatAction(activity.action, activity.details)}</span>
                    </p>
                    <p className="text-[10px] text-white/30 mt-0.5">
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
