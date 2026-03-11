'use client'

import { useState } from 'react'

interface Props {
  currentOrganizerId: string | null
  currentOrganizerName: string | null
  volunteerName: string | null
  organizers: { id: string; name: string }[]
  onReassign: (newOrgId: string) => void
}

export default function OrganizerSelect({ currentOrganizerId, currentOrganizerName, volunteerName, organizers, onReassign }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)

  if (confirming) {
    const newOrg = organizers.find(o => o.id === confirming)
    return (
      <div className="flex flex-col gap-1 min-w-[140px]">
        <p className="text-[10px] text-amber-300 leading-tight">
          Move <span className="font-bold">{volunteerName}</span> + all contacts to <span className="font-bold">{newOrg?.name || 'Unassigned'}</span>?
        </p>
        <div className="flex gap-1">
          <button
            onClick={() => { onReassign(confirming); setConfirming(null); setEditing(false) }}
            className="px-2 py-0.5 text-[10px] font-bold rounded bg-vc-purple text-white hover:bg-vc-purple/80"
          >
            Yes
          </button>
          <button
            onClick={() => { setConfirming(null); setEditing(false) }}
            className="px-2 py-0.5 text-[10px] rounded bg-white/5 text-white/50 hover:bg-white/10"
          >
            No
          </button>
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <select
        autoFocus
        value={currentOrganizerId || ''}
        onChange={e => {
          if (e.target.value !== (currentOrganizerId || '')) {
            setConfirming(e.target.value)
          } else {
            setEditing(false)
          }
        }}
        onBlur={() => setEditing(false)}
        className="bg-white/[0.06] border border-vc-purple/30 rounded px-1.5 py-0.5 text-xs text-white/70 outline-none min-w-[100px]"
      >
        <option value="" className="bg-[#1a1025]">Unassigned</option>
        {organizers.map(o => (
          <option key={o.id} value={o.id} className="bg-[#1a1025]">{o.name}</option>
        ))}
      </select>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-white/50 text-sm truncate hover:text-white/80 hover:underline decoration-dotted underline-offset-2 cursor-pointer transition-colors"
      title="Click to reassign organizer"
    >
      {currentOrganizerName || '—'}
    </button>
  )
}
