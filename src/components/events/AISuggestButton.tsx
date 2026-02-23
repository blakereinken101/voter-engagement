'use client'

import { useState } from 'react'
import { Wand2, Loader2 } from 'lucide-react'

interface Props {
  field: 'title' | 'description'
  eventType: string
  title?: string
  description?: string
  locationName?: string
  locationCity?: string
  isVirtual?: boolean
  onSuggestion: (suggestion: string) => void
  disabled?: boolean
}

export default function AISuggestButton({
  field,
  eventType,
  title,
  description,
  locationName,
  locationCity,
  isVirtual,
  onSuggestion,
  disabled,
}: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading || disabled) return
    setLoading(true)

    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field,
          eventType,
          title,
          description,
          locationName,
          locationCity,
          isVirtual,
        }),
      })

      if (!res.ok) {
        console.error('AI suggest failed:', res.status)
        return
      }

      const data = await res.json()
      if (data.suggestion) {
        onSuggestion(data.suggestion)
      }
    } catch (err) {
      console.error('AI suggest error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || disabled}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-white/30 hover:text-vc-purple-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      title={`AI suggest ${field}`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Wand2 className="w-3.5 h-3.5" />
      )}
    </button>
  )
}
