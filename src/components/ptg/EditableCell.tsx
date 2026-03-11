'use client'

import { useState, useRef, useEffect } from 'react'
import clsx from 'clsx'

const OUTCOME_OPTIONS = [
  { value: '', label: '—' },
  { value: 'supporter', label: 'Supporter' },
  { value: 'lean-supporter', label: 'Lean Sup.' },
  { value: 'undecided', label: 'Undecided' },
  { value: 'lean-opposed', label: 'Lean Opp.' },
  { value: 'opposed', label: 'Opposed' },
  { value: 'left-message', label: 'Left Msg' },
  { value: 'no-answer', label: 'No Answer' },
  { value: 'moved', label: 'Moved' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'refused', label: 'Refused' },
]

interface EditableCellProps {
  value: string | null
  field: string
  contactId: string
  onSave: (contactId: string, field: string, value: string) => Promise<void>
  type?: 'text' | 'outcome' | 'textarea'
  className?: string
}

export default function EditableCell({ value, field, contactId, onSave, type = 'text', className }: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select()
      }
    }
  }, [editing])

  const handleSave = async () => {
    if (draft === (value || '')) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(contactId, field, draft)
    } catch { /* parent handles error */ }
    setSaving(false)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      setDraft(value || '')
      setEditing(false)
    }
  }

  if (!editing) {
    if (type === 'outcome') {
      return (
        <button
          onClick={() => { setDraft(value || ''); setEditing(true) }}
          className={clsx(
            'px-2 py-0.5 rounded text-xs font-medium transition-all cursor-pointer w-full text-left',
            !value && 'text-white/20 hover:text-white/40',
            value === 'supporter' && 'bg-emerald-500/20 text-emerald-300',
            value === 'lean-supporter' && 'bg-emerald-500/10 text-emerald-400/70',
            value === 'undecided' && 'bg-amber-500/15 text-amber-300',
            value === 'lean-opposed' && 'bg-orange-500/15 text-orange-300',
            value === 'opposed' && 'bg-red-500/15 text-red-400',
            value === 'left-message' && 'bg-blue-500/15 text-blue-300',
            value === 'no-answer' && 'bg-white/5 text-white/40',
            (value === 'moved' || value === 'deceased' || value === 'refused') && 'bg-white/5 text-white/30',
            className,
          )}
        >
          {value ? OUTCOME_OPTIONS.find(o => o.value === value)?.label || value : '—'}
        </button>
      )
    }

    return (
      <div
        onClick={() => { setDraft(value || ''); setEditing(true) }}
        className={clsx(
          'cursor-pointer py-0.5 rounded text-sm text-white/70 hover:bg-white/5 transition-colors min-h-[24px] truncate',
          // Only apply default horizontal padding if none is provided via props
          (className && /\bpx?-/.test(className)) ? '' : 'px-1.5',
          !value && 'text-white/15 italic',
          className,
        )}
        title={value || undefined}
      >
        {value || '—'}
      </div>
    )
  }

  // Editing mode
  if (type === 'outcome') {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={draft}
        onChange={e => { setDraft(e.target.value); }}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className="w-full bg-white/10 border border-vc-purple/40 rounded px-1.5 py-0.5 text-xs text-white outline-none focus:ring-1 focus:ring-vc-purple/60"
      >
        {OUTCOME_OPTIONS.map(o => (
          <option key={o.value} value={o.value} className="bg-[#1a1025] text-white">{o.label}</option>
        ))}
      </select>
    )
  }

  if (type === 'textarea') {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => { if (e.key === 'Escape') { setDraft(value || ''); setEditing(false) } }}
        disabled={saving}
        rows={2}
        className="w-full bg-white/10 border border-vc-purple/40 rounded px-1.5 py-0.5 text-sm text-white outline-none focus:ring-1 focus:ring-vc-purple/60 resize-none"
      />
    )
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type="text"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      disabled={saving}
      className="w-full bg-white/10 border border-vc-purple/40 rounded px-1.5 py-0.5 text-sm text-white outline-none focus:ring-1 focus:ring-vc-purple/60"
    />
  )
}
