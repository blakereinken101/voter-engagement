'use client'

import { useState } from 'react'
import campaignConfig from '@/lib/campaign-config'
import { ClipboardCheck, ExternalLink, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

const stateNames: Record<string, string> = {
  NC: 'North Carolina',
  CA: 'California',
  TX: 'Texas',
  FL: 'Florida',
  NY: 'New York',
  PA: 'Pennsylvania',
  OH: 'Ohio',
  GA: 'Georgia',
  MI: 'Michigan',
  AZ: 'Arizona',
}

const stateRegistrationUrls: Record<string, string> = {
  NC: 'https://www.ncsbe.gov/registering/how-register',
  CA: 'https://registertovote.ca.gov/',
  TX: 'https://www.votetexas.gov/register-to-vote/',
  FL: 'https://registertovoteflorida.gov/',
  NY: 'https://dmv.ny.gov/more-info/electronic-voter-registration-application',
  PA: 'https://www.vote.pa.gov/Register-to-Vote/',
  OH: 'https://www.ohiosos.gov/elections/voters/register/',
  GA: 'https://mvp.sos.ga.gov/s/',
  MI: 'https://mvic.sos.state.mi.us/RegisterVoter',
  AZ: 'https://azsos.gov/elections/voting-election/register-vote',
}

function getRegistrationUrl(stateAbbr: string): string {
  if (stateRegistrationUrls[stateAbbr]) {
    return stateRegistrationUrls[stateAbbr]
  }
  const name = stateNames[stateAbbr]
  if (name) {
    return `https://www.vote.org/register-to-vote/${name.toLowerCase().replace(/\s+/g, '-')}/`
  }
  return 'https://www.vote.org/register-to-vote/'
}

const CHECK_REGISTRATION_URL = 'https://www.vote.org/am-i-registered-to-vote/'

export default function VoterRegistrationLinks() {
  const [isExpanded, setIsExpanded] = useState(false)

  const stateAbbr = campaignConfig.state
  const stateName = stateNames[stateAbbr] || stateAbbr
  const registrationUrl = getRegistrationUrl(stateAbbr)

  return (
    <div className="glass-card p-4 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between hover:opacity-80 transition-opacity text-left"
      >
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-vc-purple-light" />
          <span className="text-sm font-bold text-white/70">Voter Registration</span>
        </div>
        <ChevronDown
          className={clsx(
            'w-4 h-4 text-white/30 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3 animate-fade-in">
          <p className="text-xs text-white/60">
            Help your contacts in {stateName} get registered and verify their status.
          </p>

          <div className="flex gap-2">
            <a
              href={registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-vc-teal text-white text-xs font-bold py-2 px-3 rounded-btn hover:opacity-90 transition-opacity"
            >
              Register to Vote
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={CHECK_REGISTRATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 glass-dark text-white/60 text-xs font-bold py-2 px-3 rounded-btn hover:text-white/80 transition-colors"
            >
              Check Registration
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
