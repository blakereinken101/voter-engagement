'use client'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen cosmic-bg constellation">
      {/* Header */}
      <header className="glass-dark border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Threshold" width={400} height={224} className="h-12 w-auto" priority />
          </Link>
          <Link
            href="/"
            className="text-white/60 text-sm hover:text-white transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
        </div>
      </header>

      {/* Content */}
      <article className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-4xl font-extrabold text-white mb-2 tracking-tight">Privacy Policy</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: February 22, 2026</p>

        <div className="space-y-8 text-white/70 leading-relaxed text-[15px]">
          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">1. Introduction</h2>
            <p>
              Vote Threshold LLC (&ldquo;Threshold,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the Threshold platform. This Privacy Policy describes how we collect, use, and protect your information when you use our services.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following types of information:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><span className="text-white font-semibold">Account Information:</span> When you create an account, we collect your name, email address, and password (stored in hashed form).</li>
              <li><span className="text-white font-semibold">Contact Lists:</span> Names, addresses, phone numbers, and relationship categories of people you add to your personal outreach list.</li>
              <li><span className="text-white font-semibold">Voter File Data:</span> We access publicly available voter registration records to match your contacts and provide voting history information. This data is public record maintained by state election offices.</li>
              <li><span className="text-white font-semibold">Usage Data:</span> Information about how you interact with the platform, including outreach activity, contact outcomes, and notes.</li>
              <li><span className="text-white font-semibold">Communications:</span> If you contact us, we may retain the content of those communications.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>To provide and maintain the Threshold platform and its features</li>
              <li>To match your contacts with publicly available voter registration records</li>
              <li>To generate outreach recommendations and action plans</li>
              <li>To enable campaign administrators to view aggregated activity data</li>
              <li>To communicate with you about your account and our services</li>
              <li>To improve and develop new features for the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">4. Data Sharing and Disclosure</h2>
            <p className="mb-3">We do not sell your personal information. We may share data in the following circumstances:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><span className="text-white font-semibold">Campaign Organizations:</span> If you are a member of a campaign, your activity data (contacts added, outreach completed, outcomes) may be visible to campaign administrators.</li>
              <li><span className="text-white font-semibold">Service Providers:</span> We use third-party services for hosting, email delivery, and database management. These providers only access data as needed to perform their services.</li>
              <li><span className="text-white font-semibold">Legal Requirements:</span> We may disclose information when required by law, regulation, or legal process.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">5. Voter File Data</h2>
            <p>
              Voter registration information used by Threshold is publicly available data maintained by state election authorities. This data includes names, addresses, party affiliation, and voting history (whether someone voted, not how they voted). We use this data solely to help users identify and engage with voters in their personal networks. We do not use voter file data for commercial purposes unrelated to civic engagement.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">6. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data, including encrypted connections (HTTPS/TLS), hashed passwords, secure session management, and two-factor authentication. While no system is perfectly secure, we take reasonable steps to protect against unauthorized access, alteration, or destruction of your data.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">7. Data Retention</h2>
            <p>
              We retain your account information and associated data for as long as your account is active or as needed to provide you services. Campaign data may be retained according to the campaign organization&rsquo;s policies. You may request deletion of your account and associated data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">8. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your account and personal data</li>
              <li>Export your data in a portable format</li>
              <li>Opt out of non-essential communications</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at <a href="mailto:info@votethreshold.com" className="text-vc-purple-light hover:underline">info@votethreshold.com</a>.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">9. Cookies and Tracking</h2>
            <p>
              We use essential cookies to maintain your session and preferences. These are strictly necessary for the platform to function. We do not use third-party advertising cookies or tracking pixels.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">10. Children&rsquo;s Privacy</h2>
            <p>
              Threshold is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected data from someone under 18, we will take steps to delete that information.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on the platform or sending an email to the address associated with your account. Your continued use of the platform after changes take effect constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">12. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="mt-3 glass-card p-4 text-sm">
              <p className="text-white font-bold">Vote Threshold LLC</p>
              <p>Email: <a href="mailto:info@votethreshold.com" className="text-vc-purple-light hover:underline">info@votethreshold.com</a></p>
            </div>
          </section>
        </div>
      </article>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-white/5">
        <p className="text-white/30 text-xs">
          &copy; {new Date().getFullYear()} Vote Threshold LLC. All Rights Reserved.
        </p>
      </footer>
    </main>
  )
}
