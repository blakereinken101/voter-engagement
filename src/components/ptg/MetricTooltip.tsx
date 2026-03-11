'use client'

import { HelpCircle } from 'lucide-react'

export default function MetricTooltip({ text }: { text: string }) {
  return (
    <span className="relative group/tip inline-flex items-center ml-1">
      <HelpCircle className="w-3.5 h-3.5 text-white/30 group-hover/tip:text-white/60 transition-colors cursor-help" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-[#1a1025] text-white/80 text-xs leading-snug px-2.5 py-1.5 rounded-lg border border-white/10 shadow-lg shadow-black/30 opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50 w-[200px] text-center">
        {text}
      </span>
    </span>
  )
}
