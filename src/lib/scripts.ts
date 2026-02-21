import { ConversationScript, VoterSegment, RelationshipCategory } from '@/types'

function getRelationshipContext(category: RelationshipCategory): string {
  const contexts: Record<RelationshipCategory, string> = {
    'household': 'You live together, so keep it casual — bring it up over dinner or while doing chores. No need to make it A Thing.',
    'close-family': 'This is family, so be direct but loving. You know each other well enough to skip the small talk.',
    'extended-family': 'Family events are a natural opening. Keep it brief and warm — no one wants a lecture at Thanksgiving.',
    'best-friends': 'Your best friend will hear you out. Be real, be yourself. This conversation can go deep.',
    'close-friends': 'Good friends respect your opinion. Keep it light but honest.',
    'neighbors': 'You share a community. Lead with what is happening locally — the issues are literally on your street.',
    'coworkers': 'Keep it appropriate for the relationship. A quick "hey, are you voting?" at lunch goes a long way.',
    'faith-community': 'Lean into shared values. Civic participation connects naturally to caring for your community.',
    'school-pta': 'School board and local races directly affect your kids. That is a powerful shared interest.',
    'sports-recreation': 'Keep it casual — bring it up before or after your activity. "Hey, random question..." works great.',
    'hobby-groups': 'You already share interests. This is just one more thing you can connect on.',
    'community-regulars': 'This is a lighter relationship, so keep it short and friendly. Plant a seed, do not give a speech.',
    'recent-meals': 'You recently shared a meal — you have trust and warmth to work with. Follow up naturally.',
    'who-did-we-miss': 'You know this person well enough to include them. Trust your instinct on how to approach them.',
  }
  return contexts[category]
}

export const CONVERSATION_SCRIPTS: Record<VoterSegment, ConversationScript> = {
  'super-voter': {
    segment: 'super-voter',
    title: 'Ask Them to Step Up',
    introduction: 'This person already shows up. Every time. Your job is not to convince them to vote — it is to channel their energy. Ask them to volunteer, to bring someone else to the polls, or to join you in outreach. They are a force multiplier. Treat them like one.',
    keyPoints: [
      'Acknowledge what they already do — people who vote consistently rarely hear "thank you"',
      'Make a specific ask: "Will you knock doors with me Saturday?" not "Do you want to help?"',
      'Frame it as doing it together, not asking them to do something alone',
      'If they say no to volunteering, ask if they will bring one person to vote',
      'Give them an easy out but leave the door open',
    ],
    sampleConversation: [
      { speaker: 'you', text: 'Hey, I know you are someone who always shows up to vote. I respect that.' },
      { speaker: 'them', text: 'Yeah, I try to make it every time.' },
      { speaker: 'you', text: 'That is exactly why I am reaching out. I am doing some voter outreach and I am looking for people who already get it. Would you be down to knock on some doors with me one Saturday?' },
      { speaker: 'them', text: 'I do not know, I have never done that before.' },
      { speaker: 'you', text: 'Neither had I until recently. They train you on everything. I just figured it would be way less awkward if I had someone I actually like with me.' },
    ],
    closingAsk: 'Make one clear ask: "Will you join me for one shift?" or "Can I sign you up?" Do not end the conversation without asking for something specific.',
    tips: [
      'Do it together — "join me" is always more powerful than "go do this"',
      'If they push back on canvassing, suggest phone banking from home',
      'Never make them feel like what they do is not enough',
      'Follow up with a date, time, and link within 24 hours',
      'If they bring one more voter, they have doubled their impact',
    ],
    textTemplate: 'Hey [Name]! I know you are someone who always votes and I really respect that. I am getting into voter outreach and looking for people to join me. Would you be down to volunteer together for one shift? No pressure but I think it would be fun with someone I know.',
    callOpener: 'Hey [Name], got a sec? I wanted to ask you something. I know you always vote, and honestly that is part of why I am calling...',
    oneOnOneSetup: 'Ask them to grab coffee and say you want to talk about getting more involved in your community. Frame it as something you are exploring together, not a pitch.',
  },

  'sometimes-voter': {
    segment: 'sometimes-voter',
    title: 'Give Them the Nudge',
    introduction: 'This person votes sometimes — usually in the big ones. They do not need to be convinced that voting matters. They need someone they trust to make it feel personal and urgent, especially for midterms and local races. Your relationship is the most powerful tool here. A text from you matters more than any ad.',
    keyPoints: [
      'Ask, do not lecture — find out what they care about',
      'Connect their issues to specific local or state races',
      'Offer something concrete: go together, share a registration link, send early voting dates',
      'Follow up closer to Election Day — one conversation now, one reminder later',
      'It is okay if this takes two conversations',
    ],
    sampleConversation: [
      { speaker: 'you', text: 'Hey, random question — are you planning to vote this fall?' },
      { speaker: 'them', text: 'Probably for the big race. I usually skip the other stuff honestly.' },
      { speaker: 'you', text: 'I used to do the same thing. But I started looking at the local races and that is where so much of it actually gets decided. Like the school board stuff — that has been wild.' },
      { speaker: 'them', text: 'Yeah I have heard about that actually.' },
      { speaker: 'you', text: 'Midterm turnout is so low that your vote literally counts way more. Want to go vote together? Or I can send you the early voting dates so you can do it whenever.' },
    ],
    closingAsk: 'End with something they can say yes to right now: "Can I send you the early voting info?" or "Want to go together on Saturday?" Small yes now, bigger yes later.',
    tips: [
      'Lead with curiosity, not judgment — "Do you usually vote in midterms?" not "You should vote in midterms"',
      'Share your own journey: "I used to skip them too until I realized..."',
      'Personalize to their issues — ask first, then connect the dots',
      'Follow up with a text the week before AND the day before the election',
      'If they commit, make a plan: what day, what time, where',
      'Even if they push back, plant the seed: "Just think about it"',
    ],
    textTemplate: 'Hey [Name]! Quick q — are you planning to vote this fall? I have been paying more attention to local races lately and honestly they matter way more than I realized. Would love to chat about it or go vote together if you are down.',
    callOpener: 'Hey [Name], I will be quick — I have been thinking about the election coming up and wanted to check in. Are you planning to vote?',
    oneOnOneSetup: 'Suggest a casual meetup and mention you have been thinking about local politics lately. Keep it light — "I am not trying to recruit you, I just want to talk about it with someone I trust."',
  },

  'rarely-voter': {
    segment: 'rarely-voter',
    title: 'Start the Conversation',
    introduction: 'This person rarely or never votes. They might be disillusioned, overwhelmed, or just disconnected. The worst thing you can do is lecture them or make them feel bad. Your only goal right now is to have a real conversation, share why you vote, and listen. This plants a seed. Seeds take time.',
    keyPoints: [
      'This is a listening conversation — ask more than you tell',
      'Share your own story: why you vote, what changed for you',
      'Ask open questions about what frustrates them or what they wish was different',
      'Do not argue, pressure, or shame — ever',
      'Leave the door open for a follow-up, do not push for a commitment',
    ],
    sampleConversation: [
      { speaker: 'you', text: 'This might be random, but have you been thinking about the election at all?' },
      { speaker: 'them', text: 'Not really. It feels like it does not matter.' },
      { speaker: 'you', text: 'I get that. For real. Can I ask you something though — is there anything going on right now that actually frustrates you? Like something you wish was different?' },
      { speaker: 'them', text: 'I mean, [issue] has been a mess.' },
      { speaker: 'you', text: 'Yeah, that is real. I started voting partly because of stuff like that. I am not saying it fixes everything, but I felt like if I did not show up at all, I had zero say. What would it take for you to feel like it was worth your time?' },
      { speaker: 'them', text: 'I do not know. Maybe if I felt like my vote counted.' },
      { speaker: 'you', text: 'That makes total sense. I am not going to push you on it. But if you ever want to know more about how to register or where to vote, I am here. No pressure at all.' },
    ],
    closingAsk: 'Do not force it. End with: "Would it be cool if I checked in with you closer to the election?" or "I will send you a link, no pressure." Stay in relationship.',
    tips: [
      'Listen twice as much as you talk',
      'Never say "you should vote" — say "here is why I vote"',
      'Do not debate policy — this is about participation, not persuasion',
      'Ask about their life, their frustrations, what they want for their community',
      'It may take 2-3 conversations to move someone — that is normal and good',
      'Acknowledge their skepticism instead of dismissing it',
      'If they do register or vote, celebrate it — make it feel significant',
      'This conversation is planting a seed, not harvesting a vote',
    ],
    textTemplate: 'Hey [Name], random question and totally no pressure — have you been thinking about the election at all? I have been getting more into it lately and honestly just curious what you think.',
    callOpener: 'Hey [Name], hope you are doing good. I wanted to ask you something kind of random — have you been thinking about the election at all?',
    oneOnOneSetup: 'Do not lead with politics. Get together for a normal reason — coffee, a walk, whatever you would normally do. Bring it up naturally during the conversation.',
  },
}

export function getScriptForSegment(segment: VoterSegment): ConversationScript {
  return CONVERSATION_SCRIPTS[segment]
}

export function getRelationshipTip(category: RelationshipCategory): string {
  return getRelationshipContext(category)
}
