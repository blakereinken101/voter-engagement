'use client'
import { useMemo } from 'react'
import { ActionPlanItem, ContactOutcome } from '@/types'
import { isResponseOutcome } from '@/lib/contact-config'
import { useAuth } from '@/context/AuthContext'
import defaultCampaignConfig from '@/lib/campaign-config'
import { ClipboardList } from 'lucide-react'

interface Props {
  personId: string
  actionItem?: ActionPlanItem
  contacted: boolean
  contactOutcome?: ContactOutcome
  onSurveyChange: (personId: string, responses: Record<string, string>) => void
}

export default function SurveyInline({ personId, actionItem, contacted, contactOutcome, onSurveyChange }: Props) {
  const { campaignConfig: authConfig } = useAuth()
  const campaignConfig = authConfig || defaultCampaignConfig

  const allSurveyQuestions = useMemo(() => {
    const custom = (campaignConfig.aiContext?.customSurveyQuestions || []).map(q => ({
      id: q.id, label: q.question, type: q.type, options: q.options,
    }))
    return [...campaignConfig.surveyQuestions, ...custom]
  }, [campaignConfig])

  // Only show after a response outcome (supporter, undecided, opposed)
  if (!contacted || !contactOutcome || !isResponseOutcome(contactOutcome) || allSurveyQuestions.length === 0) {
    return null
  }

  return (
    <div className="animate-fade-in">
      <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1">
        <ClipboardList className="w-3 h-3" />
        Quick survey
      </p>
      <div className="flex flex-wrap gap-2">
        {allSurveyQuestions.map(q => (
          <div key={q.id} className="flex-1 min-w-[120px]">
            <label className="text-[10px] text-white/50 block mb-0.5">{q.label}</label>
            {q.type === 'select' && q.options ? (
              <select
                value={actionItem?.surveyResponses?.[q.id] ?? ''}
                onChange={e => {
                  const updated = { ...(actionItem?.surveyResponses || {}), [q.id]: e.target.value }
                  onSurveyChange(personId, updated)
                }}
                className="glass-input w-full px-2 py-1.5 rounded-btn text-[11px]"
              >
                <option value="">—</option>
                {q.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={actionItem?.surveyResponses?.[q.id] ?? ''}
                onChange={e => {
                  const updated = { ...(actionItem?.surveyResponses || {}), [q.id]: e.target.value }
                  onSurveyChange(personId, updated)
                }}
                className="glass-input w-full px-2 py-1.5 rounded-btn text-[11px]"
                placeholder={q.label}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
