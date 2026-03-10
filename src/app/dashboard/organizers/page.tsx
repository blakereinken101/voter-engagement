'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import { ArrowLeft, LogOut, Users, User, GripVertical, Loader2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'

interface VolunteerData {
  id: string
  name: string
  email: string
  role: string
  region: string | null
  contactCount: number
}

interface OrganizerData {
  id: string
  name: string
  role: string
  region: string | null
  volunteers: VolunteerData[]
}

export default function OrganizersPage() {
  const { user, signOut, isAdmin, isLoading } = useAuth()
  const [organizers, setOrganizers] = useState<OrganizerData[]>([])
  const [unassigned, setUnassigned] = useState<VolunteerData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set())

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    volunteerId: string
    volunteerName: string
    fromOrgName: string
    toOrgId: string | null
    toOrgName: string
  } | null>(null)

  // Drag state
  const dragRef = useRef<{ volunteerId: string; volunteerName: string; fromOrgId: string | null; fromOrgName: string } | null>(null)

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ptg/assignments')
      if (res.ok) {
        const data = await res.json()
        setOrganizers(data.organizers || [])
        setUnassigned(data.unassigned || [])
        // Auto-expand all organizers on first load
        if (data.organizers?.length) {
          setExpandedOrgs(new Set(data.organizers.map((o: OrganizerData) => o.id)))
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAssignments() }, [fetchAssignments])

  const handleReassign = async (volunteerId: string, organizerId: string | null) => {
    setSaving(true)
    setConfirmDialog(null)
    try {
      const res = await fetch('/api/admin/ptg/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volunteerId, organizerId }),
      })
      if (res.ok) {
        await fetchAssignments()
      }
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  const handleDragStart = (vol: VolunteerData, fromOrgId: string | null, fromOrgName: string) => {
    dragRef.current = { volunteerId: vol.id, volunteerName: vol.name, fromOrgId, fromOrgName }
  }

  const handleDrop = (toOrgId: string | null, toOrgName: string) => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.fromOrgId === toOrgId) return // same organizer, no-op

    setConfirmDialog({
      volunteerId: drag.volunteerId,
      volunteerName: drag.volunteerName,
      fromOrgName: drag.fromOrgName,
      toOrgId,
      toOrgName,
    })
    dragRef.current = null
  }

  const toggleOrg = (orgId: string) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev)
      if (next.has(orgId)) next.delete(orgId)
      else next.add(orgId)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen cosmic-bg flex items-center justify-center">
        <div className="text-white/40 animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen cosmic-bg flex items-center justify-center">
        <div className="glass-card p-8 text-center max-w-md">
          <h2 className="text-xl font-bold text-white mb-2">Admin Access Required</h2>
          <p className="text-white/50 mb-4">This page is only available to campaign administrators.</p>
          <Link href="/dashboard" className="text-vc-purple-light hover:underline text-sm">Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen cosmic-bg">
      <div className="constellation" />

      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-black/30 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-white/40 text-sm">{user.name}</span>
            <button onClick={signOut} className="text-white/30 hover:text-white/60 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-vc-purple via-vc-purple to-vc-teal flex items-center justify-center shadow-lg shadow-vc-purple/20">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-vc-purple to-vc-teal opacity-20 blur-md -z-10" />
          </div>
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              Organizer Assignments
            </h2>
            <div className="text-[10px] text-white/30 font-medium tracking-widest uppercase">
              Drag volunteers between organizers
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-vc-purple-light animate-spin" />
          </div>
        ) : (
          <div className={`space-y-3 ${saving ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Organizer buckets */}
            {organizers.map(org => (
              <div
                key={org.id}
                className="rounded-xl border border-white/[0.08] bg-white/[0.015] overflow-hidden"
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(org.id, org.name)}
              >
                <button
                  onClick={() => toggleOrg(org.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                >
                  {expandedOrgs.has(org.id)
                    ? <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
                  }
                  <div className="w-8 h-8 rounded-lg bg-vc-purple/20 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-vc-purple-light" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{org.name}</p>
                    <p className="text-[11px] text-white/40">
                      {org.role} {org.region ? `· ${org.region}` : ''}
                      {' · '}{org.volunteers.length} volunteer{org.volunteers.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-lg font-bold text-white/30 tabular-nums">{org.volunteers.length}</span>
                </button>

                {expandedOrgs.has(org.id) && (
                  <div className="border-t border-white/[0.06] px-2 py-2 space-y-1 min-h-[48px]">
                    {org.volunteers.length === 0 ? (
                      <p className="text-xs text-white/20 text-center py-3">
                        Drop volunteers here to assign
                      </p>
                    ) : (
                      org.volunteers.map(vol => (
                        <VolunteerRow
                          key={vol.id}
                          vol={vol}
                          onDragStart={() => handleDragStart(vol, org.id, org.name)}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Unassigned bucket */}
            <div
              className="rounded-xl border border-dashed border-white/[0.12] bg-white/[0.01] overflow-hidden"
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(null, 'Unassigned')}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-400/60" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white/50">Unassigned</p>
                  <p className="text-[11px] text-white/30">
                    {unassigned.length} volunteer{unassigned.length !== 1 ? 's' : ''} with no organizer
                  </p>
                </div>
                <span className="text-lg font-bold text-amber-400/40 tabular-nums">{unassigned.length}</span>
              </div>
              {unassigned.length > 0 && (
                <div className="border-t border-white/[0.06] px-2 py-2 space-y-1">
                  {unassigned.map(vol => (
                    <VolunteerRow
                      key={vol.id}
                      vol={vol}
                      onDragStart={() => handleDragStart(vol, null, 'Unassigned')}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-6 max-w-md mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Reassign Volunteer</h3>
                <p className="text-xs text-white/40">This will change their organizer assignment</p>
              </div>
            </div>

            <div className="bg-white/[0.03] rounded-lg p-3 space-y-2">
              <p className="text-sm text-white">
                Move <span className="font-bold">{confirmDialog.volunteerName}</span> from{' '}
                <span className="font-bold text-white/70">{confirmDialog.fromOrgName}</span> to{' '}
                <span className="font-bold text-vc-purple-light">{confirmDialog.toOrgName}</span>?
              </p>
              <p className="text-[11px] text-white/30">
                Their contacts and conversation history will remain unchanged. Only the organizer assignment will be updated.
              </p>
            </div>

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="text-sm text-white/50 hover:text-white px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReassign(confirmDialog.volunteerId, confirmDialog.toOrgId)}
                className="text-sm text-white font-bold px-4 py-2 rounded-lg bg-vc-purple hover:bg-vc-purple/80 transition-colors"
              >
                Reassign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VolunteerRow({ vol, onDragStart }: { vol: VolunteerData; onDragStart: () => void }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] cursor-grab active:cursor-grabbing transition-colors group"
    >
      <GripVertical className="w-3.5 h-3.5 text-white/10 group-hover:text-white/30 shrink-0" />
      <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center shrink-0">
        <User className="w-3.5 h-3.5 text-white/30" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80 font-medium truncate">{vol.name}</p>
        <p className="text-[10px] text-white/30 truncate">
          {vol.email}
          {vol.region ? ` · ${vol.region}` : ''}
        </p>
      </div>
      <span className="text-xs text-white/25 tabular-nums shrink-0">
        {vol.contactCount} contact{vol.contactCount !== 1 ? 's' : ''}
      </span>
    </div>
  )
}
