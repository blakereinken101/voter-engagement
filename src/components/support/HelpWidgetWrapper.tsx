'use client'

import dynamic from 'next/dynamic'

// Lazy-load the help widget to avoid loading AI/support code on every page
const HelpWidget = dynamic(() => import('./HelpWidget'), { ssr: false })

export default function HelpWidgetWrapper() {
  return <HelpWidget />
}
