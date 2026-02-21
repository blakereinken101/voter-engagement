'use client'

import { useState, useEffect } from 'react'
import { Share2, Copy, Check } from 'lucide-react'
import campaignConfig from '@/lib/campaign-config'

export default function SocialShareBar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  // Avoid SSR mismatch — only read window.location.origin after mount
  useEffect(() => {
    setShareUrl(window.location.origin)
  }, [])

  const shareText = `I'm using ${campaignConfig.name} to reach my network before Election Day. Your vote matters \u2014 let's make sure everyone shows up. Join me: ${shareUrl}`

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: campaignConfig.name,
          text: shareText,
          url: shareUrl,
        })
      } catch {
        // User cancelled or share failed — silently ignore
      }
    } else {
      await handleCopy()
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard write failed — silently ignore
    }
  }

  return (
    <div className="glass-card p-4">
      {/* Collapsible header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between hover:opacity-80 transition-opacity text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-white/70">
          <Share2 className="w-4 h-4 text-vc-purple-light" />
          Share with friends
        </span>
        <span className="text-white/30 text-xs">
          {isExpanded ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3 animate-fade-in">
          <p className="text-xs text-white/60 leading-relaxed">
            {shareText}
          </p>

          <div className="flex gap-2">
            {/* Web Share API button */}
            <button
              onClick={handleShare}
              className="flex-1 bg-vc-purple text-white px-4 py-2 rounded-btn text-sm font-bold hover:bg-vc-purple/80 transition-all shadow-glow flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>

            {/* Copy link button */}
            <button
              onClick={handleCopy}
              className="glass-dark text-white/60 hover:text-white px-4 py-2 rounded-btn text-sm font-bold transition-all flex items-center justify-center gap-2 border border-white/10"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-vc-purple-light" />
                  <span className="text-vc-purple-light">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Link
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
