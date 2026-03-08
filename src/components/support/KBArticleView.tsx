'use client'

import { useState } from 'react'
import { ArrowLeft, ThumbsUp, ThumbsDown, Check } from 'lucide-react'
import type { KBArticle } from '@/types'

interface Props {
  article: KBArticle
  onBack: () => void
}

export default function KBArticleView({ article, onBack }: Props) {
  const [feedback, setFeedback] = useState<'helpful' | 'not-helpful' | null>(null)

  const handleFeedback = async (helpful: boolean) => {
    setFeedback(helpful ? 'helpful' : 'not-helpful')
    try {
      await fetch(`/api/support/kb/${article.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      })
    } catch {
      // Non-fatal
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors mb-2"
        >
          <ArrowLeft className="w-3 h-3" />
          Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40">{article.category}</span>
        <h3 className="text-base font-semibold mt-2 mb-3">{article.title}</h3>
        <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{article.content}</div>

        {/* Feedback */}
        <div className="mt-4 pt-3 border-t border-white/10">
          {feedback ? (
            <p className="text-xs text-white/40 flex items-center gap-1">
              <Check className="w-3 h-3 text-green-400" />
              Thanks for your feedback!
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/40">Was this helpful?</span>
              <button
                onClick={() => handleFeedback(true)}
                className="p-1.5 hover:bg-green-500/10 rounded-lg transition-colors"
              >
                <ThumbsUp className="w-4 h-4 text-white/40 hover:text-green-400" />
              </button>
              <button
                onClick={() => handleFeedback(false)}
                className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <ThumbsDown className="w-4 h-4 text-white/40 hover:text-red-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
