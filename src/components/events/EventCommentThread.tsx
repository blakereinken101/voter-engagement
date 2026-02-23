'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { EventComment } from '@/types/events'
import { MessageCircle, Reply, Trash2, Edit2, Send } from 'lucide-react'

interface Props {
  eventId: string
}

export default function EventCommentThread({ eventId }: Props) {
  const { user } = useAuth()
  const [comments, setComments] = useState<EventComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchComments()
  }, [eventId])

  async function fetchComments() {
    try {
      const res = await fetch(`/api/events/${eventId}/comments`)
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments || [])
      }
    } catch { /* ignore */ }
  }

  async function postComment(content: string, parentId?: string) {
    if (!content.trim() || !user) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), parentId }),
      })
      if (res.ok) {
        setNewComment('')
        setReplyContent('')
        setReplyingTo(null)
        await fetchComments()
      }
    } catch { /* ignore */ }
    setIsLoading(false)
  }

  async function editComment(commentId: string) {
    if (!editContent.trim()) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() }),
      })
      if (res.ok) {
        setEditingId(null)
        setEditContent('')
        await fetchComments()
      }
    } catch { /* ignore */ }
    setIsLoading(false)
  }

  async function deleteComment(commentId: string) {
    try {
      const res = await fetch(`/api/events/${eventId}/comments/${commentId}`, { method: 'DELETE' })
      if (res.ok) await fetchComments()
    } catch { /* ignore */ }
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function CommentItem({ comment, isReply = false }: { comment: EventComment; isReply?: boolean }) {
    const isEditing = editingId === comment.id
    const isOwner = user?.id === comment.userId

    return (
      <div className={`${isReply ? 'ml-8 border-l-2 border-white/5 pl-4' : ''}`}>
        <div className="flex items-start gap-3 py-3">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-vc-purple/30 ring-1 ring-vc-purple/40 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {(comment.userName || '?').charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{comment.userName || 'User'}</span>
              <span className="text-xs text-white/40">{formatTime(comment.createdAt)}</span>
              {comment.updatedAt !== comment.createdAt && (
                <span className="text-xs text-white/30">(edited)</span>
              )}
            </div>

            {/* Content */}
            {isEditing ? (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="glass-input flex-1 px-3 py-1.5 text-sm"
                  onKeyDown={e => e.key === 'Enter' && editComment(comment.id)}
                />
                <button onClick={() => editComment(comment.id)} disabled={isLoading} className="text-vc-teal text-sm">Save</button>
                <button onClick={() => { setEditingId(null); setEditContent('') }} className="text-white/40 text-sm">Cancel</button>
              </div>
            ) : (
              <p className="text-sm text-white/80 mt-0.5">{comment.content}</p>
            )}

            {/* Actions */}
            {!isEditing && user && (
              <div className="flex items-center gap-3 mt-1.5">
                {!isReply && (
                  <button
                    onClick={() => { setReplyingTo(replyingTo === comment.id ? null : comment.id); setReplyContent('') }}
                    className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
                  >
                    <Reply className="w-3 h-3" />
                    Reply
                  </button>
                )}
                {isOwner && (
                  <>
                    <button
                      onClick={() => { setEditingId(comment.id); setEditContent(comment.content) }}
                      className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => deleteComment(comment.id)}
                      className="flex items-center gap-1 text-xs text-white/40 hover:text-vc-coral transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Reply form */}
        {replyingTo === comment.id && (
          <div className="ml-11 mt-1 mb-3 flex gap-2 animate-fade-in">
            <input
              type="text"
              value={replyContent}
              onChange={e => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="glass-input flex-1 px-3 py-1.5 text-sm"
              onKeyDown={e => e.key === 'Enter' && postComment(replyContent, comment.id)}
              autoFocus
            />
            <button
              onClick={() => postComment(replyContent, comment.id)}
              disabled={!replyContent.trim() || isLoading}
              className="text-vc-teal disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Replies */}
        {comment.replies?.map(reply => (
          <CommentItem key={reply.id} comment={reply} isReply />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-medium text-white/70">
        <MessageCircle className="w-4 h-4" />
        Comments ({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)})
      </h3>

      {/* Comment input */}
      {user ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="glass-input flex-1 px-3 py-2 text-sm"
            onKeyDown={e => e.key === 'Enter' && postComment(newComment)}
          />
          <button
            onClick={() => postComment(newComment)}
            disabled={!newComment.trim() || isLoading}
            className="bg-vc-purple/20 hover:bg-vc-purple/30 text-vc-purple-light px-3 py-2 rounded-btn transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <p className="text-sm text-white/40">Sign in to comment</p>
      )}

      {/* Comments list */}
      <div className="divide-y divide-white/5">
        {comments.map(comment => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>

      {comments.length === 0 && (
        <p className="text-sm text-white/30 py-4 text-center">No comments yet</p>
      )}
    </div>
  )
}
