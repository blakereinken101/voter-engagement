'use client'

import { useState, useEffect } from 'react'
import { Save, CheckCircle, AlertCircle, Sparkles, Plus, Trash2, Shield, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import type {
  AICampaignContext as AICampaignContextType,
  CampaignType,
  GoalPriority,
  CandidateInfo,
  ElectionInfo,
  PartyStrategies,
  CustomSurveyQuestion,
  FundraisingConfig,
  FundraiserTypeConfig,
  TargetUniverseConfig,
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
  const { user } = useAuth()
  const isPlatformAdmin = !!user?.isPlatformAdmin

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
  const [rawOptionsText, setRawOptionsText] = useState<Record<string, string>>({})
  const [fundraisingConfig, setFundraisingConfig] = useState<FundraisingConfig>({})
  const [targetUniverse, setTargetUniverse] = useState<TargetUniverseConfig>({})
  const [promptOverrides, setPromptOverrides] = useState<Record<string, string> | undefined>()

  // Platform overrides (platform admin only)
  const [platformOverrides, setPlatformOverrides] = useState<Partial<AICampaignContextType>>({})
  const [overridesExpanded, setOverridesExpanded] = useState(false)

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
          setFundraisingConfig(ctx.fundraisingConfig || {})
          setTargetUniverse(ctx.targetUniverse || {})
          setPromptOverrides(ctx.promptOverrides)
        }
        if (data.platformOverrides) {
          setPlatformOverrides(data.platformOverrides)
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

  // Survey question helpers
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

  // Fundraiser type helpers
  const addFundraiserType = () => {
    setFundraisingConfig(prev => ({
      ...prev,
      fundraiserTypes: [
        ...(prev.fundraiserTypes || []),
        { id: crypto.randomUUID(), name: '', guidance: '' },
      ],
    }))
  }

  const updateFundraiserType = (id: string, field: keyof FundraiserTypeConfig, value: string) => {
    setFundraisingConfig(prev => ({
      ...prev,
      fundraiserTypes: (prev.fundraiserTypes || []).map(ft =>
        ft.id === id ? { ...ft, [field]: value } : ft
      ),
    }))
  }

  const removeFundraiserType = (id: string) => {
    setFundraisingConfig(prev => ({
      ...prev,
      fundraiserTypes: (prev.fundraiserTypes || []).filter(ft => ft.id !== id),
    }))
  }

  // Platform override fundraiser type helpers
  const addOverrideFundraiserType = () => {
    setPlatformOverrides(prev => ({
      ...prev,
      fundraisingConfig: {
        ...prev.fundraisingConfig,
        fundraiserTypes: [
          ...(prev.fundraisingConfig?.fundraiserTypes || []),
          { id: crypto.randomUUID(), name: '', guidance: '' },
        ],
      },
    }))
  }

  const updateOverrideFundraiserType = (id: string, field: keyof FundraiserTypeConfig, value: string) => {
    setPlatformOverrides(prev => ({
      ...prev,
      fundraisingConfig: {
        ...prev.fundraisingConfig,
        fundraiserTypes: (prev.fundraisingConfig?.fundraiserTypes || []).map(ft =>
          ft.id === id ? { ...ft, [field]: value } : ft
        ),
      },
    }))
  }

  const removeOverrideFundraiserType = (id: string) => {
    setPlatformOverrides(prev => ({
      ...prev,
      fundraisingConfig: {
        ...prev.fundraisingConfig,
        fundraiserTypes: (prev.fundraisingConfig?.fundraiserTypes || []).filter(ft => ft.id !== id),
      },
    }))
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
        fundraisingConfig: (fundraisingConfig.requireResidency || fundraisingConfig.contributionLimits || fundraisingConfig.fundraisingGuidance || (fundraisingConfig.fundraiserTypes && fundraisingConfig.fundraiserTypes.length > 0))
          ? fundraisingConfig
          : undefined,
        targetUniverse: Object.values(targetUniverse).some(v => v)
          ? targetUniverse
          : undefined,
        promptOverrides,
      }

      const payload: Record<string, unknown> = { aiContext }

      // Include platform overrides if platform admin
      if (isPlatformAdmin) {
        payload.platformOverrides = platformOverrides
      }

      const res = await fetch('/api/campaign/ai-context', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

      {/* Platform Admin Overrides */}
      {isPlatformAdmin && (
        <div className="glass-card p-5 space-y-4 border border-amber-500/30 bg-amber-500/5">
          <button
            onClick={() => setOverridesExpanded(!overridesExpanded)}
            className="flex items-center gap-2 w-full text-left"
          >
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-300">Platform Admin Overrides</span>
            <span className="text-xs text-amber-400/50 ml-1">Values here override campaign admin settings</span>
            {overridesExpanded ? (
              <ChevronDown className="w-4 h-4 text-amber-400/50 ml-auto" />
            ) : (
              <ChevronRight className="w-4 h-4 text-amber-400/50 ml-auto" />
            )}
          </button>

          {overridesExpanded && (
            <div className="space-y-4 pt-2 border-t border-amber-500/20">
              <p className="text-xs text-amber-400/40">
                Any field set here will take priority over the campaign admin's values. Leave blank to use campaign admin's settings.
              </p>

              <div>
                <label className="block text-xs text-amber-400/60 mb-1">Goals Override</label>
                <textarea
                  value={platformOverrides.goals || ''}
                  onChange={e => setPlatformOverrides(prev => ({ ...prev, goals: e.target.value || undefined }))}
                  placeholder="Override campaign goals..."
                  rows={2}
                  className={`${inputClass} resize-none border-amber-500/20`}
                />
              </div>

              <div>
                <label className="block text-xs text-amber-400/60 mb-1">Messaging Guidance Override</label>
                <textarea
                  value={platformOverrides.messagingGuidance || ''}
                  onChange={e => setPlatformOverrides(prev => ({ ...prev, messagingGuidance: e.target.value || undefined }))}
                  placeholder="Override messaging guidance..."
                  rows={2}
                  className={`${inputClass} resize-none border-amber-500/20`}
                />
              </div>

              <div>
                <label className="block text-xs text-amber-400/60 mb-1">Talking Points Override (one per line)</label>
                <textarea
                  value={platformOverrides.talkingPoints?.join('\n') || ''}
                  onChange={e => setPlatformOverrides(prev => ({
                    ...prev,
                    talkingPoints: e.target.value.trim() ? e.target.value.split('\n').map(s => s.trim()).filter(Boolean) : undefined,
                  }))}
                  placeholder="Override talking points..."
                  rows={3}
                  className={`${inputClass} resize-none border-amber-500/20`}
                />
              </div>

              <div>
                <label className="block text-xs text-amber-400/60 mb-1">Contribution Limits Override</label>
                <input
                  type="text"
                  value={platformOverrides.fundraisingConfig?.contributionLimits || ''}
                  onChange={e => setPlatformOverrides(prev => ({
                    ...prev,
                    fundraisingConfig: { ...prev.fundraisingConfig, contributionLimits: e.target.value || undefined },
                  }))}
                  placeholder="Override contribution limits..."
                  className={`${inputClass} border-amber-500/20`}
                />
              </div>

              <div>
                <label className="block text-xs text-amber-400/60 mb-1">Fundraising Guidance Override</label>
                <textarea
                  value={platformOverrides.fundraisingConfig?.fundraisingGuidance || ''}
                  onChange={e => setPlatformOverrides(prev => ({
                    ...prev,
                    fundraisingConfig: { ...prev.fundraisingConfig, fundraisingGuidance: e.target.value || undefined },
                  }))}
                  placeholder="Override fundraising guidance..."
                  rows={3}
                  className={`${inputClass} resize-none border-amber-500/20`}
                />
              </div>

              {/* Override Fundraiser Types */}
              <div>
                <label className="block text-xs text-amber-400/60 mb-1">Fundraiser Types Override</label>
                <p className="text-xs text-amber-400/30 mb-2">Define fundraiser types that override campaign admin's types</p>
                <div className="space-y-3">
                  {(platformOverrides.fundraisingConfig?.fundraiserTypes || []).map(ft => (
                    <div key={ft.id} className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={ft.name}
                          onChange={e => updateOverrideFundraiserType(ft.id, 'name', e.target.value)}
                          placeholder="e.g., Grassroots, Max Out Event"
                          className={`${inputClass} border-amber-500/20`}
                        />
                        <textarea
                          value={ft.guidance}
                          onChange={e => updateOverrideFundraiserType(ft.id, 'guidance', e.target.value)}
                          placeholder="AI coaching guidance for this fundraiser type..."
                          rows={2}
                          className={`${inputClass} resize-none border-amber-500/20`}
                        />
                      </div>
                      <button
                        onClick={() => removeOverrideFundraiserType(ft.id)}
                        className="text-white/20 hover:text-red-400 transition-colors p-2 mt-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addOverrideFundraiserType}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs font-bold text-amber-400/50 hover:text-amber-300 hover:border-amber-500/30 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add fundraiser type override
                  </button>
                </div>
              </div>
            </div>
          )}
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

      {/* Target Universe */}
      <div>
        <label className={labelClass}>
          Target Universe <span className={sublabelClass}>(which voters should volunteers prioritize?)</span>
        </label>
        <p className="text-xs text-white/40 mb-3 -mt-1">
          Define your target universe by setting criteria on each election.
          Voters matching ALL set criteria get a gold star in the rolodex.
          Leave an election unset to ignore it.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {([
            { field: 'VH2024G' as const, label: '2024 General' },
            { field: 'VH2022G' as const, label: '2022 General' },
            { field: 'VH2020G' as const, label: '2020 General' },
            { field: 'VH2024P' as const, label: '2024 Primary' },
            { field: 'VH2022P' as const, label: '2022 Primary' },
            { field: 'VH2020P' as const, label: '2020 Primary' },
          ]).map(({ field, label }) => (
            <div key={field}>
              <label className="block text-xs text-white/40 mb-1">{label}</label>
              <select
                value={targetUniverse[field] || ''}
                onChange={e => setTargetUniverse(prev => ({
                  ...prev,
                  [field]: e.target.value || undefined,
                }))}
                className={inputClass}
              >
                <option value="">Don&apos;t care</option>
                <option value="voted">Voted</option>
                <option value="did-not-vote">Did Not Vote</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Fundraising Settings — only shown when fundraising is a goal priority */}
      {goalPriorities.includes('fundraising') && (
        <div className="glass-card p-5 space-y-4 border border-vc-purple/20">
          <label className={labelClass}>
            Fundraising Settings <span className={sublabelClass}>(shown because fundraising is a goal priority)</span>
          </label>
          <p className="text-xs text-white/40 -mt-1">
            When fundraising is your #1 or #2 priority, the AI will ask volunteers whether they're doing voter contact or fundraising, then coach accordingly.
          </p>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="requireResidency"
              checked={fundraisingConfig.requireResidency || false}
              onChange={e => setFundraisingConfig(prev => ({ ...prev, requireResidency: e.target.checked }))}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-vc-purple focus:ring-vc-purple/30"
            />
            <label htmlFor="requireResidency" className="text-sm text-white/70">
              Require residency check for fundraising volunteers
            </label>
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1">Contribution Limits</label>
            <input
              type="text"
              value={fundraisingConfig.contributionLimits || ''}
              onChange={e => setFundraisingConfig(prev => ({ ...prev, contributionLimits: e.target.value }))}
              placeholder="e.g., $3,300 per individual per election, $5,000 PAC limit"
              className={inputClass}
            />
            <p className="text-xs text-white/30 mt-1">The AI will share these limits with volunteers when relevant</p>
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1">Additional Fundraising Guidance</label>
            <textarea
              value={fundraisingConfig.fundraisingGuidance || ''}
              onChange={e => setFundraisingConfig(prev => ({ ...prev, fundraisingGuidance: e.target.value }))}
              placeholder="Any campaign-specific fundraising coaching guidance for the AI..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Fundraiser Types */}
          <div>
            <label className="block text-xs text-white/40 mb-1">Fundraiser Types</label>
            <p className="text-xs text-white/30 mb-2">
              Define different types of fundraisers (e.g., Grassroots, Max Out). Each type gets its own AI coaching guidance. Volunteers will be asked which type they're working on.
            </p>
            <div className="space-y-3">
              {(fundraisingConfig.fundraiserTypes || []).map(ft => (
                <div key={ft.id} className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={ft.name}
                      onChange={e => updateFundraiserType(ft.id, 'name', e.target.value)}
                      placeholder="e.g., Grassroots, Max Out Event, House Party"
                      className={inputClass}
                    />
                    <textarea
                      value={ft.guidance}
                      onChange={e => updateFundraiserType(ft.id, 'guidance', e.target.value)}
                      placeholder="AI coaching guidance specific to this fundraiser type..."
                      rows={2}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                  <button
                    onClick={() => removeFundraiserType(ft.id)}
                    className="text-white/20 hover:text-red-400 transition-colors p-2 mt-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addFundraiserType}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs font-bold text-white/50 hover:text-white hover:border-white/30 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add fundraiser type
              </button>
            </div>
          </div>
        </div>
      )}

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
          Custom Survey Questions
        </label>
        <p className="text-xs text-white/40 mb-3 -mt-1">
          Add questions for volunteers to ask during voter outreach. These appear in both AI chat mode and the manual rolodex. Responses are tracked per contact and included in data exports.
        </p>
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
                      value={rawOptionsText[q.id] ?? q.options?.join(', ') ?? ''}
                      onChange={e => setRawOptionsText(prev => ({ ...prev, [q.id]: e.target.value }))}
                      onBlur={e => {
                        const parsed = e.target.value.split(',').map(o => o.trim()).filter(Boolean)
                        updateSurveyQuestion(q.id, { options: parsed })
                        setRawOptionsText(prev => { const next = { ...prev }; delete next[q.id]; return next })
                      }}
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
