'use client'

import { useState, useEffect } from 'react'
import { Save, CheckCircle, AlertCircle, Sparkles, Plus, Trash2 } from 'lucide-react'
import type {
  AICampaignContext as AICampaignContextType,
  CampaignType,
  GoalPriority,
  CandidateInfo,
  ElectionInfo,
  PartyStrategies,
  CustomSurveyQuestion,
} from '@/types'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

const GOAL_OPTIONS: { value: GoalPriority; label: string }[] = [
  { value: 'volunteer-recruitment', label: 'Volunteer Recruitment' },
  { value: 'voter-turnout', label: 'Voter Turnout' },
  { value: 'persuasion', label: 'Persuasion' },
  { value: 'fundraising', label: 'Fundraising' },
]

export default function AICampaignContext() {
  // Existing fields
  const [goals, setGoals] = useState('')
  const [keyIssues, setKeyIssues] = useState('')
  const [talkingPoints, setTalkingPoints] = useState('')
  const [messagingGuidance, setMessagingGuidance] = useState('')

  // New structured fields
  const [campaignType, setCampaignType] = useState<CampaignType | ''>('')
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo>({})
  const [electionInfo, setElectionInfo] = useState<ElectionInfo>({})
  const [goalPriorities, setGoalPriorities] = useState<GoalPriority[]>([])
  const [partyStrategies, setPartyStrategies] = useState<PartyStrategies>({})
  const [customSurveyQuestions, setCustomSurveyQuestions] = useState<CustomSurveyQuestion[]>([])

  // UI state
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
          setCampaignType(ctx.campaignType || '')
          setCandidateInfo(ctx.candidateInfo || {})
          setElectionInfo(ctx.electionInfo || {})
          setGoalPriorities(ctx.goalPriorities || [])
          setPartyStrategies(ctx.partyStrategies || {})
          setCustomSurveyQuestions(ctx.customSurveyQuestions || [])
        }
      })
      .catch(() => setError('Failed to load AI context'))
      .finally(() => setLoading(false))
  }, [])

  const toggleGoalPriority = (goal: GoalPriority) => {
    setGoalPriorities(prev =>
      prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal],
    )
  }

  const addSurveyQuestion = () => {
    setCustomSurveyQuestions(prev => [
      ...prev,
      { id: crypto.randomUUID(), question: '', type: 'text' },
    ])
  }

  const updateSurveyQuestion = (id: string, updates: Partial<CustomSurveyQuestion>) => {
    setCustomSurveyQuestions(prev =>
      prev.map(q => (q.id === id ? { ...q, ...updates } : q)),
    )
  }

  const removeSurveyQuestion = (id: string) => {
    setCustomSurveyQuestions(prev => prev.filter(q => q.id !== id))
  }

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
        campaignType: campaignType || undefined,
        candidateInfo: (candidateInfo.name || candidateInfo.party || candidateInfo.office)
          ? candidateInfo
          : undefined,
        electionInfo: (electionInfo.date || electionInfo.state || electionInfo.district)
          ? electionInfo
          : undefined,
        goalPriorities: goalPriorities.length > 0 ? goalPriorities : undefined,
        partyStrategies: (partyStrategies.DEM || partyStrategies.REP || partyStrategies.UNF || partyStrategies.OTHER)
          ? partyStrategies
          : undefined,
        customSurveyQuestions: customSurveyQuestions.filter(q => q.question.trim()).length > 0
          ? customSurveyQuestions.filter(q => q.question.trim())
          : undefined,
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

  const inputClass = 'glass-input w-full rounded-btn px-4 py-3 text-sm focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all'
  const labelClass = 'block text-sm font-semibold text-white/70 mb-2'
  const sublabelClass = 'text-white/30 font-normal'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-vc-purple/20 ring-2 ring-vc-purple/40 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-vc-purple-light" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">AI Coach Settings</h3>
          <p className="text-xs text-white/40">Configure what the AI coach knows about your campaign</p>
        </div>
      </div>

      {/* Status messages */}
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

      {/* Campaign Type */}
      <div>
        <label className={labelClass}>Campaign Type</label>
        <select
          value={campaignType}
          onChange={e => setCampaignType(e.target.value as CampaignType | '')}
          className={inputClass}
        >
          <option value="">Select type...</option>
          <option value="candidate">Candidate</option>
          <option value="ballot-measure">Ballot Measure</option>
          <option value="issue-advocacy">Issue Advocacy</option>
        </select>
      </div>

      {/* Candidate Info */}
      {(campaignType === 'candidate' || campaignType === '') && (
        <div>
          <label className={labelClass}>Candidate Information</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={candidateInfo.name || ''}
              onChange={e => setCandidateInfo(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Candidate name"
              className={inputClass}
            />
            <select
              value={candidateInfo.party || ''}
              onChange={e => setCandidateInfo(prev => ({ ...prev, party: e.target.value }))}
              className={inputClass}
            >
              <option value="">Party...</option>
              <option value="Democrat">Democrat</option>
              <option value="Republican">Republican</option>
              <option value="Independent">Independent</option>
              <option value="Libertarian">Libertarian</option>
              <option value="Green">Green</option>
              <option value="Other">Other</option>
            </select>
            <input
              type="text"
              value={candidateInfo.office || ''}
              onChange={e => setCandidateInfo(prev => ({ ...prev, office: e.target.value }))}
              placeholder="Office (e.g., State Senate Dist. 12)"
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* Election Info */}
      <div>
        <label className={labelClass}>Election Information</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="date"
            value={electionInfo.date || ''}
            onChange={e => setElectionInfo(prev => ({ ...prev, date: e.target.value }))}
            className={inputClass}
          />
          <select
            value={electionInfo.state || ''}
            onChange={e => setElectionInfo(prev => ({ ...prev, state: e.target.value }))}
            className={inputClass}
          >
            <option value="">State...</option>
            {US_STATES.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          <input
            type="text"
            value={electionInfo.district || ''}
            onChange={e => setElectionInfo(prev => ({ ...prev, district: e.target.value }))}
            placeholder="District (optional)"
            className={inputClass}
          />
        </div>
      </div>

      {/* Goal Priorities */}
      <div>
        <label className={labelClass}>
          Goal Priorities <span className={sublabelClass}>(click in order of priority)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {GOAL_OPTIONS.map(goal => {
            const idx = goalPriorities.indexOf(goal.value)
            const isActive = idx !== -1
            return (
              <button
                key={goal.value}
                onClick={() => toggleGoalPriority(goal.value)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-vc-purple text-white shadow-glow'
                    : 'glass text-white/50 hover:text-white hover:border-white/30'
                }`}
              >
                {isActive && <span className="mr-1.5">{idx + 1}.</span>}
                {goal.label}
              </button>
            )
          })}
        </div>
        {goalPriorities.length > 0 && (
          <p className="text-xs text-white/30 mt-2">
            Priority order: {goalPriorities.map((g, i) => `${i + 1}. ${g.replace(/-/g, ' ')}`).join(', ')}
          </p>
        )}
      </div>

      {/* Party-Based Strategy */}
      <div>
        <label className={labelClass}>
          Party-Based Strategy <span className={sublabelClass}>(how should the AI coach conversations based on voter party?)</span>
        </label>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-white/40 mb-1">Democrats (DEM)</label>
            <input
              type="text"
              value={partyStrategies.DEM || ''}
              onChange={e => setPartyStrategies(prev => ({ ...prev, DEM: e.target.value }))}
              placeholder="e.g., Focus on turnout — make sure they vote"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Republicans (REP)</label>
            <input
              type="text"
              value={partyStrategies.REP || ''}
              onChange={e => setPartyStrategies(prev => ({ ...prev, REP: e.target.value }))}
              placeholder="e.g., Persuasion — explain candidate's position on shared values"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Unaffiliated / Independent (UNF/IND)</label>
            <input
              type="text"
              value={partyStrategies.UNF || ''}
              onChange={e => setPartyStrategies(prev => ({ ...prev, UNF: e.target.value }))}
              placeholder="e.g., Persuasion — introduce candidate and key issues"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Other Parties</label>
            <input
              type="text"
              value={partyStrategies.OTHER || ''}
              onChange={e => setPartyStrategies(prev => ({ ...prev, OTHER: e.target.value }))}
              placeholder="e.g., General outreach"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Campaign Goals */}
      <div>
        <label className={labelClass}>Campaign Goals</label>
        <textarea
          value={goals}
          onChange={e => setGoals(e.target.value)}
          placeholder="What is this campaign trying to achieve? E.g., 'Elect Selena Meyer by increasing voter turnout among Democrats and persuading unaffiliated voters...'"
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Key Issues */}
      <div>
        <label className={labelClass}>
          Key Issues <span className={sublabelClass}>(one per line)</span>
        </label>
        <textarea
          value={keyIssues}
          onChange={e => setKeyIssues(e.target.value)}
          placeholder={"Education funding\nHealthcare access\nAffordable housing\nLocal infrastructure"}
          rows={4}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Talking Points */}
      <div>
        <label className={labelClass}>
          Candidate Talking Points <span className={sublabelClass}>(one per line)</span>
        </label>
        <textarea
          value={talkingPoints}
          onChange={e => setTalkingPoints(e.target.value)}
          placeholder={"15 years of experience in education policy\nOnly candidate with a concrete plan for housing\nEndorsed by the local teachers union and firefighters"}
          rows={4}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Messaging Guidance */}
      <div>
        <label className={labelClass}>Messaging Guidance</label>
        <textarea
          value={messagingGuidance}
          onChange={e => setMessagingGuidance(e.target.value)}
          placeholder="Tone should be positive and forward-looking. Avoid attacking opponents directly. Focus on community and shared values..."
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Custom Survey Questions */}
      <div>
        <label className={labelClass}>
          Custom Survey Questions <span className={sublabelClass}>(asked during voter conversations)</span>
        </label>
        <div className="space-y-3">
          {customSurveyQuestions.map(q => (
            <div key={q.id} className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={q.question}
                  onChange={e => updateSurveyQuestion(q.id, { question: e.target.value })}
                  placeholder="Question text..."
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <select
                    value={q.type}
                    onChange={e => updateSurveyQuestion(q.id, { type: e.target.value as 'text' | 'select' })}
                    className={`${inputClass} !w-auto`}
                  >
                    <option value="text">Free text</option>
                    <option value="select">Multiple choice</option>
                  </select>
                  {q.type === 'select' && (
                    <input
                      type="text"
                      value={q.options?.join(', ') || ''}
                      onChange={e => updateSurveyQuestion(q.id, {
                        options: e.target.value.split(',').map(o => o.trim()).filter(Boolean),
                      })}
                      placeholder="Options (comma-separated)"
                      className={`${inputClass} flex-1`}
                    />
                  )}
                </div>
              </div>
              <button
                onClick={() => removeSurveyQuestion(q.id)}
                className="text-white/20 hover:text-red-400 transition-colors p-2 mt-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={addSurveyQuestion}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs font-bold text-white/50 hover:text-white hover:border-white/30 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add question
          </button>
        </div>
      </div>

      {/* Save */}
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
