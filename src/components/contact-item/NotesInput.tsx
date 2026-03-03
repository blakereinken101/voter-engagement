'use client'
import { useState } from 'react'

interface Props {
  personId: string
  initialNotes: string
  onNotesChange: (personId: string, notes: string) => void
}

export default function NotesInput({ personId, initialNotes, onNotesChange }: Props) {
  const [localNotes, setLocalNotes] = useState(initialNotes)
  const isDirty = localNotes !== initialNotes

  return (
    <div className="flex gap-1.5 items-center">
      <input
        type="text"
        value={localNotes}
        onChange={e => setLocalNotes(e.target.value)}
        onBlur={() => { if (isDirty) onNotesChange(personId, localNotes) }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            onNotesChange(personId, localNotes);
            (e.target as HTMLInputElement).blur()
          }
        }}
        placeholder="Notes..."
        className="glass-input flex-1 px-3 py-2 rounded-btn text-xs focus:outline-none focus:ring-1 focus:ring-vc-purple/30"
      />
      {isDirty && (
        <button
          onClick={() => onNotesChange(personId, localNotes)}
          className="text-[9px] font-bold bg-vc-purple text-white px-2 py-1 rounded-btn hover:bg-vc-purple-light transition-colors whitespace-nowrap flex-shrink-0"
        >
          Save
        </button>
      )}
    </div>
  )
}
