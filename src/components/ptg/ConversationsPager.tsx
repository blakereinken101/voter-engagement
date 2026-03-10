'use client'

import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export default function ConversationsPager({ page, pageSize, total, onPageChange }: Props) {
  const totalPages = Math.ceil(total / pageSize)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  if (total === 0) return null

  return (
    <div className="flex items-center justify-between px-1 py-3">
      <span className="text-xs text-white/40 tabular-nums">
        Showing <span className="text-white/60 font-medium">{from}–{to}</span> of{' '}
        <span className="text-white/60 font-medium">{total.toLocaleString()}</span>
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={clsx(
            'p-1.5 rounded-lg transition-all',
            page <= 1 ? 'text-white/10 cursor-not-allowed' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-white/40 tabular-nums px-2">
          Page <span className="text-white/60 font-medium">{page}</span> of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={clsx(
            'p-1.5 rounded-lg transition-all',
            page >= totalPages ? 'text-white/10 cursor-not-allowed' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
          )}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
