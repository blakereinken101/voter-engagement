import type { Metadata } from 'next'
import './globals.css'
import { AppProvider } from '@/context/AppContext'
import { AuthProvider } from '@/context/AuthContext'

export const metadata: Metadata = {
  title: 'VoteCircle — Your Network Is Your Most Powerful Vote',
  description: 'Build your list. Find your people. Start conversations that move them to the polls.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-rally-cream text-rally-navy">
        <AuthProvider>
          <AppProvider>
            {children}
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
