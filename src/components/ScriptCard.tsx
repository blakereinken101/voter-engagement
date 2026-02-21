'use client'
import { ConversationScript, OutreachMethod } from '@/types'
import { useState } from 'react'
import clsx from 'clsx'

interface Props {
  script: ConversationScript
  personName?: string
}

export default function ScriptCard({ script, personName }: Props) {
  const [activeMethod, setActiveMethod] = useState<OutreachMethod>('text')

  const methods: { id: OutreachMethod; label: string; icon: string }[] = [
    { id: 'text', label: 'Text', icon: '💬' },
    { id: 'call', label: 'Call', icon: '📞' },
    { id: 'one-on-one', label: '1:1 Meetup', icon: '☕' },
  ]

  const name = personName ?? '[Name]'

  function insertName(text: string): string {
    return text.replace(/\[Name\]/g, name)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-rally-navy px-6 py-4">
        <h3 className="font-display text-xl font-bold text-white">{script.title}</h3>
      </div>

      <div className="p-6">
        <p className="text-rally-slate text-sm leading-relaxed mb-5">{script.introduction}</p>

        {/* Key points */}
        <div className="mb-5">
          <h4 className="font-bold text-xs uppercase tracking-wider text-rally-slate-light mb-2">Remember</h4>
          <ul className="space-y-1.5">
            {script.keyPoints.map((point, i) => (
              <li key={i} className="text-sm text-rally-slate flex gap-2">
                <span className="text-rally-red font-bold">→</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Outreach method tabs */}
        <div className="mb-5">
          <h4 className="font-bold text-xs uppercase tracking-wider text-rally-slate-light mb-3">How to reach out</h4>
          <div className="flex gap-2 mb-4">
            {methods.map(m => (
              <button
                key={m.id}
                onClick={() => setActiveMethod(m.id)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-bold transition-all',
                  activeMethod === m.id
                    ? 'bg-rally-navy text-white'
                    : 'bg-gray-100 text-rally-slate-light hover:bg-gray-200'
                )}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {activeMethod === 'text' && (
            <div className="bg-rally-navy/5 rounded-lg p-4 animate-fade-in">
              <p className="text-xs text-rally-slate-light mb-2 font-bold uppercase tracking-wider">Copy this text</p>
              <p className="text-sm text-rally-navy leading-relaxed">{insertName(script.textTemplate)}</p>
            </div>
          )}

          {activeMethod === 'call' && (
            <div className="bg-rally-navy/5 rounded-lg p-4 animate-fade-in">
              <p className="text-xs text-rally-slate-light mb-2 font-bold uppercase tracking-wider">Start with</p>
              <p className="text-sm text-rally-navy leading-relaxed italic">{insertName(script.callOpener)}</p>
            </div>
          )}

          {activeMethod === 'one-on-one' && (
            <div className="bg-rally-navy/5 rounded-lg p-4 animate-fade-in">
              <p className="text-xs text-rally-slate-light mb-2 font-bold uppercase tracking-wider">How to set it up</p>
              <p className="text-sm text-rally-navy leading-relaxed">{insertName(script.oneOnOneSetup)}</p>
            </div>
          )}
        </div>

        {/* Sample conversation */}
        <details className="mb-5">
          <summary className="font-bold text-xs uppercase tracking-wider text-rally-slate-light cursor-pointer hover:text-rally-navy transition-colors">
            Sample conversation
          </summary>
          <div className="space-y-3 mt-4">
            {script.sampleConversation.map((line, i) => (
              <div
                key={i}
                className={clsx(
                  'rounded-xl p-3 text-sm max-w-[85%]',
                  line.speaker === 'you'
                    ? 'bg-rally-red text-white ml-0'
                    : 'bg-gray-100 text-rally-slate ml-auto'
                )}
              >
                <div className={clsx(
                  'text-[10px] font-bold mb-1 uppercase tracking-wider',
                  line.speaker === 'you' ? 'text-white/60' : 'text-rally-slate-light'
                )}>
                  {line.speaker === 'you' ? 'You' : 'Them'}
                </div>
                <p className="italic">{insertName(line.text)}</p>
              </div>
            ))}
          </div>
        </details>

        {/* Closing ask */}
        <div className="bg-rally-yellow/10 border border-rally-yellow/30 rounded-lg p-4 mb-5">
          <h4 className="font-bold text-xs uppercase tracking-wider text-rally-slate mb-1">The Ask</h4>
          <p className="text-sm text-rally-slate">{script.closingAsk}</p>
        </div>

        {/* Tips */}
        <details>
          <summary className="font-bold text-xs uppercase tracking-wider text-rally-slate-light cursor-pointer hover:text-rally-navy transition-colors">
            Tips
          </summary>
          <ul className="mt-3 space-y-2">
            {script.tips.map((tip, i) => (
              <li key={i} className="text-sm text-rally-slate flex gap-2">
                <span className="text-rally-yellow">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  )
}
