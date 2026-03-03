'use client'
import { PersonEntry, OutreachMethod, MatchResult } from '@/types'
import { OUTREACH_LABELS } from '@/lib/contact-config'
import { generateSmsLinkForContact } from '@/lib/sms-templates'
import { useAuth } from '@/context/AuthContext'
import defaultCampaignConfig from '@/lib/campaign-config'
import { Smartphone } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  person: PersonEntry
  matchResult?: MatchResult
  contacted: boolean
  outreachMethod?: OutreachMethod
  onToggleContacted: (personId: string, method: OutreachMethod) => void
}

export default function OutreachButtons({ person, matchResult, contacted, outreachMethod, onToggleContacted }: Props) {
  const { user, campaignConfig: authConfig } = useAuth()
  const campaignConfig = authConfig || defaultCampaignConfig

  // Already contacted — show method badge
  if (contacted && outreachMethod) {
    const info = OUTREACH_LABELS[outreachMethod]
    const MethodIcon = info.Icon
    return (
      <p className="text-[10px] text-white/50 flex items-center gap-1">
        Via <MethodIcon className="w-3 h-3" /> {info.label}
      </p>
    )
  }

  // Not contacted — show outreach buttons
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(Object.entries(OUTREACH_LABELS) as [OutreachMethod, typeof OUTREACH_LABELS[OutreachMethod]][]).map(([method, { label, Icon, tip }]) => (
          <button
            key={method}
            onClick={() => onToggleContacted(person.id, method)}
            className="flex-1 py-2 rounded-btn text-xs font-bold border border-white/15 text-white/70 hover:border-vc-purple hover:bg-vc-purple hover:text-white transition-all flex items-center justify-center gap-1.5"
            title={tip}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
      <button
        disabled={!person.phone}
        onClick={() => {
          if (person.phone) {
            const smsUrl = generateSmsLinkForContact(
              person.phone,
              person.firstName,
              user?.name ?? 'Friend',
              matchResult?.segment,
              campaignConfig.electionDate
            )
            window.open(smsUrl, '_blank')
            onToggleContacted(person.id, 'text')
          }
        }}
        className={clsx(
          'w-full py-2 rounded-btn text-xs font-bold transition-all flex items-center justify-center gap-1.5',
          person.phone
            ? 'bg-vc-teal/15 text-vc-teal border border-vc-teal/30 hover:bg-vc-teal hover:text-white'
            : 'bg-white/5 text-white/20 border border-white/10 cursor-not-allowed'
        )}
        title={person.phone ? 'Send SMS with template' : 'No phone number'}
      >
        <Smartphone className="w-3.5 h-3.5" />
        Send Text
      </button>
    </div>
  )
}
