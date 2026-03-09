import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import { AppProvider } from '@/context/AppContext'
import { AuthProvider } from '@/context/AuthContext'
import ScrollToTop from '@/components/ScrollToTop'
import HelpWidgetWrapper from '@/components/support/HelpWidgetWrapper'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://thresholdvote.com'),
  title: 'Threshold — Your Network Is Your Most Powerful Vote',
  description: 'Build your list. Find your people. Start conversations that move them to the polls.',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Threshold — Your Network Is Your Most Powerful Vote',
    description: 'AI-powered relational organizing. Build your list, match to the voter file, and start conversations that move people to the polls.',
    url: 'https://thresholdvote.com',
    siteName: 'Threshold',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Threshold — Your Network Is Your Most Powerful Vote',
    description: 'AI-powered relational organizing. Build your list, match to the voter file, and start conversations that move people to the polls.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <Script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}
        {/* Google tag (gtag.js) — Ads + Analytics */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-PDF28V18FB"
          strategy="afterInteractive"
        />
        <Script id="google-gtag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-PDF28V18FB');
            gtag('config', 'AW-18002223213');
          `}
        </Script>
      </head>
      <body className="bg-vc-bg text-white overflow-x-hidden">
        <ScrollToTop />
        <AuthProvider>
          <AppProvider>
            {children}
            <HelpWidgetWrapper />
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
