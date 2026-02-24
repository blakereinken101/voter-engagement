import type { Metadata } from 'next'
import PlatformNav from '@/components/platform/PlatformNav'

export const metadata: Metadata = {
  title: 'Platform Admin — Threshold',
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-vc-bg">
      <PlatformNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  )
}
