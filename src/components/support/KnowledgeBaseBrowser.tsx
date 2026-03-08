'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, ChevronRight, BookOpen } from 'lucide-react'
import type { KBArticle } from '@/types'
import KBArticleView from './KBArticleView'

export default function KnowledgeBaseBrowser() {
  const [articles, setArticles] = useState<KBArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null)

  const loadArticles = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/support/kb?${params}`)
      if (res.ok) {
        const data = await res.json()
        setArticles(data.articles)
      }
    } catch (err) {
      console.error('Failed to load articles:', err)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    loadArticles()
  }, [loadArticles])

  if (selectedArticle) {
    return <KBArticleView article={selectedArticle} onBack={() => setSelectedArticle(null)} />
  }

  // Group by category
  const grouped: Record<string, KBArticle[]> = {}
  for (const article of articles) {
    const cat = article.category
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(article)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="glass-input w-full pl-9 pr-3 py-2 rounded-full text-sm"
            placeholder="Search help articles..."
          />
        </div>
      </div>

      {/* Articles */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <p className="text-center text-white/30 text-sm py-4">Loading...</p>
        ) : articles.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="w-6 h-6 text-white/15 mx-auto mb-2" />
            <p className="text-white/30 text-xs">No articles found</p>
          </div>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-4">
              <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-1.5 px-1">
                {category}
              </h4>
              <div className="space-y-1">
                {items.map(article => (
                  <button
                    key={article.id}
                    onClick={() => setSelectedArticle(article)}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    <span className="text-sm text-white/70 flex-1 truncate">{article.title}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
