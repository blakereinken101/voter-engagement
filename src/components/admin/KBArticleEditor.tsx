'use client'

import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import type { KBArticle, TicketCategory } from '@/types'

interface Props {
  article?: KBArticle | null
  onSave: () => void
  onClose: () => void
}

const KB_CATEGORIES: { id: string; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'contacts', label: 'Contacts & Matching' },
  { id: 'events', label: 'Events' },
  { id: 'texting', label: 'Texting' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'account', label: 'Account & Billing' },
  { id: 'technical', label: 'Technical' },
]

export default function KBArticleEditor({ article, onSave, onClose }: Props) {
  const [title, setTitle] = useState(article?.title || '')
  const [content, setContent] = useState(article?.content || '')
  const [category, setCategory] = useState(article?.category || 'general')
  const [tagsInput, setTagsInput] = useState(article?.tags.join(', ') || '')
  const [isPublished, setIsPublished] = useState(article?.isPublished ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!article

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required')
      return
    }

    setSaving(true)
    setError('')

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    try {
      const url = isEdit ? `/api/support/kb/${article.id}` : '/api/support/kb'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), category, tags, isPublished }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-vc-bg border border-white/10 rounded-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Article' : 'New Help Article'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-sm text-red-400">{error}</p>}

          <div>
            <label className="block text-sm text-white/60 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="glass-input w-full px-3 py-2 rounded-btn text-sm"
              placeholder="How do I reset my password?"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-white/60 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-btn text-sm"
              >
                {KB_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={e => setIsPublished(e.target.checked)}
                  className="rounded"
                />
                Published
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              className="glass-input w-full px-3 py-2 rounded-btn text-sm"
              placeholder="password, login, authentication"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="glass-input w-full px-3 py-2 rounded-btn text-sm min-h-[200px] resize-y"
              placeholder="Write the help article content here..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-vc-purple text-white rounded-btn text-sm font-medium hover:bg-vc-purple/80 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
