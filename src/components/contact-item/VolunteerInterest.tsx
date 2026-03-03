'use client'
import { ActionPlanItem, ContactOutcome, VolunteerInterest as VolInterest } from '@/types'
import { UserPlus, Star } from 'lucide-react'

interface Props {
  personId: string
  contactOutcome?: ContactOutcome
  actionItem?: ActionPlanItem
  onVolunteerInterest: (personId: string, interest: VolInterest) => void
}

export default function VolunteerInterest({ personId, contactOutcome, actionItem, onVolunteerInterest }: Props) {
  // Only show for supporters
  if (contactOutcome !== 'supporter') return null

  // Already recorded
  if (actionItem?.volunteerInterest === 'yes') {
    return (
      <span className="text-[10px] bg-vc-purple text-white px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
        <Star className="w-3 h-3" />
        Volunteer
      </span>
    )
  }
  if (actionItem?.volunteerInterest === 'maybe') {
    return (
      <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
        <Star className="w-3 h-3" />
        Maybe Vol
      </span>
    )
  }
  if (actionItem?.volunteerInterest === 'no') {
    return (
      <span className="text-[10px] bg-white/10 text-white/40 px-2 py-0.5 rounded-full font-bold">
        No Vol
      </span>
    )
  }

  // Not asked yet — show buttons
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        onClick={() => onVolunteerInterest(personId, 'yes')}
        className="text-[10px] text-vc-purple bg-vc-purple/10 hover:bg-vc-purple hover:text-white px-1.5 py-0.5 rounded-l-full font-bold transition-colors inline-flex items-center gap-0.5"
        title="Will volunteer"
      >
        <UserPlus className="w-3 h-3" />
        Yes
      </button>
      <button
        onClick={() => onVolunteerInterest(personId, 'maybe')}
        className="text-[10px] text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500 hover:text-white px-1.5 py-0.5 font-bold transition-colors"
        title="Maybe will volunteer"
      >
        Maybe
      </button>
      <button
        onClick={() => onVolunteerInterest(personId, 'no')}
        className="text-[10px] text-white/40 bg-white/5 hover:bg-white/20 hover:text-white px-1.5 py-0.5 rounded-r-full font-bold transition-colors"
        title="Won't volunteer"
      >
        No
      </button>
    </span>
  )
}
