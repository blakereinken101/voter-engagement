'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Eye, ThumbsUp, ThumbsDown, Edit2, Trash2, BookOpen } from 'lucide-react'
import type { KBArticle } from '@/types'
import KBArticleEditor from './KBArticleEditor'

export default function KBManager() {
  const [articles, setArticles] = useState<KBArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingArticle, setEditingArticle] = useState<KBArticle | null | undefined>(undefined)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadArticles = useCallback(async () => {
    try {
      const params = new URLSearchParams({ published: 'false' })
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

  const handleDelete = async (articleId: string) => {
    if (!confirm('Delete this article? This cannot be undone.')) return
    setDeletingId(articleId)
    try {
      const res = await fetch(`/api/support/kb/${articleId}`, { method: 'DELETE' })
      if (res.ok) {
        setArticles(prev => prev.filter(a => a.id !== articleId))
      }
    } catch (err) {
      console.error('Failed to delete article:', err)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-vc-teal" />
          <h3 className="text-lg font-semibold">Knowledge Base</h3>
          <span className="text-sm text-white/40">({articles.length} articles)</span>
        </div>
        <button
          onClick={() => setEditingArticle(null)}
          className="flex items-center gap-2 px-3 py-2 bg-vc-purple text-white rounded-btn text-sm font-medium hover:bg-vc-purple/80 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Article
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="glass-input w-full pl-10 pr-4 py-2 rounded-btn text-sm"
          placeholder="Search articles..."
        />
      </div>

      {/* Article List */}
      {loading ? (
        <div className="text-center text-white/40 py-8">Loading articles...</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-8">
          <BookOpen className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-sm">No articles yet. Create your first help article.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map(article => (
            <div key={article.id} className="glass-row flex items-center justify-between p-3 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm truncate">{article.title}</h4>
                  {!article.isPublished && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Draft</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                  <span className="px-2 py-0.5 rounded-full bg-white/5">{article.category}</span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {article.viewCount}
                  </span>
                  {(article.helpfulCount > 0 || article.notHelpfulCount > 0) && (
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3 text-green-400" />
                      {article.helpfulCount}
                      <ThumbsDown className="w-3 h-3 text-red-400 ml-1" />
                      {article.notHelpfulCount}
                    </span>
                  )}
                  {article.tags.length > 0 && (
                    <span className="text-white/30 truncate max-w-[200px]">
                      {article.tags.join(', ')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 ml-3">
                <button
                  onClick={() => setEditingArticle(article)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4 text-white/60" />
                </button>
                <button
                  onClick={() => handleDelete(article.id)}
                  disabled={deletingId === article.id}
                  className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-red-400/60" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {editingArticle !== undefined && (
        <KBArticleEditor
          article={editingArticle}
          onSave={() => { setEditingArticle(undefined); loadArticles() }}
          onClose={() => setEditingArticle(undefined)}
        />
      )}
    </div>
  )
}
