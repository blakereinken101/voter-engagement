'use client'

import { HelpCircle } from 'lucide-react'

export default function MetricTooltip({ text }: { text: string }) {
  return (
    <span className="relative group/tip inline-flex items-center ml-1" tabIndex={0} aria-label={text}>
      <HelpCircle className="w-4 h-4 text-white/50 group-hover/tip:text-white/70 group-focus/tip:text-white/70 transition-colors cursor-help" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-[#1a1025] text-white/80 text-sm leading-snug px-2.5 py-1.5 rounded-lg border border-white/10 shadow-lg shadow-black/30 opacity-0 group-hover/tip:opacity-100 group-focus/tip:opacity-100 transition-opacity pointer-events-none z-50 w-[220px] text-center">
        {text}
      </span>
    </span>
  )
}
