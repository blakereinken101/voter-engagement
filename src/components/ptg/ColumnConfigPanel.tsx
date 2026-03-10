'use client'

import { useEffect, useRef } from 'react'
import type { ColumnConfig } from '@/types'
import { Eye, EyeOff } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  columns: ColumnConfig[]
  onChange: (columns: ColumnConfig[]) => void
  onClose: () => void
}

export default function ColumnConfigPanel({ columns, onChange, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const toggle = (id: string) => {
    const updated = columns.map(c =>
      c.id === id ? { ...c, visible: !c.visible } : c
    )
    onChange(updated)
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 z-50 w-64 bg-[#1a1025]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/40 p-3 space-y-1"
    >
      <div className="text-xs font-bold text-white/50 uppercase tracking-wider px-2 pb-2">Visible Columns</div>
      {columns.map(col => (
        <button
          key={col.id}
          onClick={() => toggle(col.id)}
          className={clsx(
            'flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-sm transition-all',
            col.visible
              ? 'text-white/80 hover:bg-white/5'
              : 'text-white/25 hover:bg-white/[0.03]'
          )}
        >
          {col.visible
            ? <Eye className="w-3.5 h-3.5 text-vc-purple-light shrink-0" />
            : <EyeOff className="w-3.5 h-3.5 shrink-0" />
          }
          {col.label}
        </button>
      ))}
    </div>
  )
}
