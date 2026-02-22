'use client'

import Link from 'next/link'
import Image from 'next/image'
import { UserPlus, Mail } from 'lucide-react'

export default function SignUpPage() {
  return (
    <div className="cosmic-bg constellation min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-48 md:h-64 w-auto mx-auto" priority />
          </Link>
        </div>

        <div className="glass-card p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-vc-purple/20 flex items-center justify-center mx-auto">
            <UserPlus className="w-8 h-8 text-vc-purple-light" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-2">Invite-Only Registration</h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Accounts are created through invitation links from campaign administrators.
              If you&apos;ve received an invite link, click it to create your account.
            </p>
          </div>

          <div className="glass-dark rounded-card p-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-vc-teal flex-shrink-0" />
              <p className="text-white/70 text-sm text-left">
                Contact your campaign admin to request an invitation.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-sm text-white/50">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-vc-purple-light font-bold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
