import type { Metadata } from 'next'
import EventNav from '@/components/events/EventNav'

export const metadata: Metadata = {
  title: 'Events — Threshold | Organizing Tools for Progressives',
  description: 'Discover and join progressive political events: canvassing, phone banks, rallies, voter registration drives, and more. Built for Democratic campaigns and progressive organizations.',
}

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-vc-bg">
      <EventNav />
      <main>{children}</main>
    </div>
  )
}
