import { VoterSegment } from '@/types'
import campaignConfig from '@/lib/campaign-config'

interface SmsTemplate {
  segment: VoterSegment | 'unmatched'
  message: string
}

const templates: SmsTemplate[] = [
  {
    segment: 'rarely-voter',
    message: `Hey {name}! It's {volunteer}. Quick question - are you planning to vote this November? I can help with any info you need. Let me know!`,
  },
  {
    segment: 'sometimes-voter',
    message: `Hi {name}, it's {volunteer}! Just checking in about the upcoming election on ${campaignConfig.electionDate}. Have you thought about your plan to vote? Would love to chat!`,
  },
  {
    segment: 'super-voter',
    message: `Hey {name}! {volunteer} here. Thanks for being such a consistent voter! I'm helping get more people engaged this election - know anyone who might need a nudge?`,
  },
  {
    segment: 'unmatched',
    message: `Hi {name}! It's {volunteer}. I'm reaching out to friends and neighbors about the upcoming election. Are you registered to vote? Happy to help if you need info!`,
  },
]

export function getSmsTemplate(segment: VoterSegment | 'unmatched' | undefined): string {
  const template = templates.find(t => t.segment === (segment || 'unmatched'))
  return template?.message || templates[templates.length - 1].message
}

export function fillTemplate(template: string, contactName: string, volunteerName: string): string {
  return template
    .replace(/\{name\}/g, contactName)
    .replace(/\{volunteer\}/g, volunteerName)
}

export function generateSmsLink(phone: string, message: string): string {
  const cleaned = phone.replace(/[^0-9+]/g, '')
  return `sms:${cleaned}?&body=${encodeURIComponent(message)}`
}

export function generateSmsLinkForContact(
  phone: string,
  contactFirstName: string,
  volunteerName: string,
  segment?: VoterSegment
): string {
  const template = getSmsTemplate(segment)
  const message = fillTemplate(template, contactFirstName, volunteerName)
  return generateSmsLink(phone, message)
}
