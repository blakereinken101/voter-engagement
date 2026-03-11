'use client'

import type { MatchStatus, ConfidenceLevel } from '@/types'
import clsx from 'clsx'
import { CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react'

interface Props {
  status: MatchStatus | null
  confidence: ConfidenceLevel | null
  onResolve?: () => void
}

const STATUS_CONFIG: Record<string, {
  bg: string
  text: string
  icon: typeof CheckCircle2
  label: string
}> = {
  confirmed: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    icon: CheckCircle2,
    label: 'Matched',
  },
  ambiguous: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    icon: AlertTriangle,
    label: 'Review',
  },
  unmatched: {
    bg: 'bg-red-500/15',
    text: 'text-red-300',
    icon: XCircle,
    label: 'No Match',
  },
  pending: {
    bg: 'bg-white/5',
    text: 'text-white/40',
    icon: Clock,
    label: 'Pending',
  },
}

export default function MatchStatusBadge({ status, confidence, onResolve }: Props) {
  const key = status || 'pending'
  const config = STATUS_CONFIG[key] || STATUS_CONFIG.pending
  const Icon = config.icon
  const isClickable = onResolve && (key === 'ambiguous' || key === 'unmatched' || key === 'pending')

  return (
    <button
      onClick={isClickable ? onResolve : undefined}
      disabled={!isClickable}
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide transition-all',
        config.bg,
        config.text,
        isClickable && 'cursor-pointer hover:brightness-125 hover:ring-1 hover:ring-current/20',
        !isClickable && 'cursor-default',
      )}
      title={isClickable ? 'Click to resolve match' : undefined}
    >
      <Icon className="w-3 h-3" />
      {config.label}
      {key === 'ambiguous' && confidence && (
        <span className={clsx(
          'w-1.5 h-1.5 rounded-full ml-0.5',
          confidence === 'high' && 'bg-emerald-400',
          confidence === 'medium' && 'bg-amber-400',
          confidence === 'low' && 'bg-orange-400',
          confidence === 'very-low' && 'bg-red-400',
        )} title={`Confidence: ${confidence}`} />
      )}
    </button>
  )
}
