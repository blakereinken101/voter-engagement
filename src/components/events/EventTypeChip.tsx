'use client'

import { EVENT_TYPE_CONFIG } from '@/types/events'
import type { EventType } from '@/types/events'

interface Props {
  type: EventType
  size?: 'sm' | 'md'
}

export default function EventTypeChip({ type, size = 'sm' }: Props) {
  const config = EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.community

  return (
    <span
      className={`inline-flex items-center gap-1 border rounded-full font-medium ${config.bgClass} ${
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  )
}
