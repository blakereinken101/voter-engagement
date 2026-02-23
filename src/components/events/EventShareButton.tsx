'use client'

import { useState } from 'react'
import { Share2, Check, Copy } from 'lucide-react'

interface Props {
  slug: string
  title: string
}

export default function EventShareButton({ slug, title }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = `${window.location.origin}/events/${slug}`

    // Try native share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch { /* user cancelled or not supported */ }
    }

    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/15 rounded-btn text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-vc-teal" />
          <span className="text-vc-teal">Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </>
      )}
    </button>
  )
}
