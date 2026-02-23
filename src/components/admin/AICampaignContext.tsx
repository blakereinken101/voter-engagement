'use client'

import { useState, useEffect } from 'react'
import { Save, CheckCircle, AlertCircle, Sparkles } from 'lucide-react'
import type { AICampaignContext as AICampaignContextType } from '@/types'

export default function AICampaignContext() {
  const [goals, setGoals] = useState('')
  const [keyIssues, setKeyIssues] = useState('')
  const [talkingPoints, setTalkingPoints] = useState('')
  const [messagingGuidance, setMessagingGuidance] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Load existing context
  useEffect(() => {
    fetch('/api/campaign/ai-context')
      .then(res => res.json())
      .then(data => {
        const ctx = data.aiContext as AICampaignContextType | undefined
        if (ctx) {
          setGoals(ctx.goals || '')
          setKeyIssues(ctx.keyIssues?.join('\n') || '')
          setTalkingPoints(ctx.talkingPoints?.join('\n') || '')
          setMessagingGuidance(ctx.messagingGuidance || '')
        }
      })
      .catch(() => setError('Failed to load AI context'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const aiContext: AICampaignContextType = {
        goals: goals.trim() || undefined,
        keyIssues: keyIssues.trim()
          ? keyIssues.split('\n').map(s => s.trim()).filter(Boolean)
          : undefined,
        talkingPoints: talkingPoints.trim()
          ? talkingPoints.split('\n').map(s => s.trim()).filter(Boolean)
          : undefined,
        messagingGuidance: messagingGuidance.trim() || undefined,
      }

      const res = await fetch('/api/campaign/ai-context', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiContext }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save')
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-white/40 text-sm animate-pulse">Loading AI settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-vc-purple/20 ring-2 ring-vc-purple/40 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-vc-purple-light" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">AI Coach Settings</h3>
          <p className="text-xs text-white/40">Configure what the AI coach knows about your campaign</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/20 text-red-300 text-sm px-4 py-3 rounded-lg border border-red-500/30">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 bg-vc-teal/20 text-vc-teal text-sm px-4 py-3 rounded-lg border border-vc-teal/30">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          AI context saved successfully
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-white/70 mb-2">
          Campaign Goals
        </label>
        <textarea
          value={goals}
          onChange={e => setGoals(e.target.value)}
          placeholder="What is this campaign trying to achieve? E.g., 'Elect Jane Smith to State Senate District 12 by increasing voter turnout among young voters and suburban families...'"
          rows={3}
          className="glass-input w-full rounded-btn px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-white/70 mb-2">
          Key Issues <span className="text-white/30 font-normal">(one per line)</span>
        </label>
        <textarea
          value={keyIssues}
          onChange={e => setKeyIssues(e.target.value)}
          placeholder={"Education funding\nHealthcare access\nAffordable housing\nLocal infrastructure"}
          rows={4}
          className="glass-input w-full rounded-btn px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-white/70 mb-2">
          Candidate Talking Points <span className="text-white/30 font-normal">(one per line)</span>
        </label>
        <textarea
          value={talkingPoints}
          onChange={e => setTalkingPoints(e.target.value)}
          placeholder={"Jane has 15 years of experience in education policy\nShe's the only candidate with a concrete plan for housing\nEndorsed by the local teachers union and firefighters"}
          rows={4}
          className="glass-input w-full rounded-btn px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-white/70 mb-2">
          Messaging Guidance
        </label>
        <textarea
          value={messagingGuidance}
          onChange={e => setMessagingGuidance(e.target.value)}
          placeholder="Tone should be positive and forward-looking. Avoid attacking opponents directly. Focus on community and shared values. Emphasize local impact over national politics..."
          rows={3}
          className="glass-input w-full rounded-btn px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-vc-purple hover:bg-vc-purple-light text-white font-bold py-3 px-6 rounded-btn shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {saving ? (
          <span className="animate-pulse">Saving...</span>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Save AI Context
          </>
        )}
      </button>
    </div>
  )
}
