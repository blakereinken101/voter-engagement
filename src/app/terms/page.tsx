'use client'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen cosmic-bg constellation">
      {/* Header */}
      <header className="glass-dark border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Threshold" width={800} height={448} className="h-20 md:h-28 w-auto" priority />
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
        <h1 className="font-display text-4xl font-extrabold text-white mb-2 tracking-tight">Terms of Service</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: February 25, 2026</p>

        <div className="space-y-8 text-white/70 leading-relaxed text-[15px]">
          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Threshold platform operated by Vote Threshold LLC (&ldquo;Threshold,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, do not use the platform. These Terms apply to all products offered through Threshold, including Threshold Events and Threshold Relational.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">2. Description of Services</h2>
            <p className="mb-3">Threshold provides two core products for political campaigns and civic organizations:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><span className="text-white font-semibold">Threshold Events:</span> Event management tools for creating, promoting, and managing campaign and civic events including canvasses, phone banks, rallies, fundraisers, watch parties, and community gatherings. Includes shareable event pages, RSVP management, attendee messaging, team collaboration, and organizational branding.</li>
              <li><span className="text-white font-semibold">Threshold Relational:</span> An AI-powered relational organizing tool that works like a personal campaign coach for every volunteer. Through a simple chat conversation, the AI walks volunteers through their full networks — neighborhood, workplace, church, gym, old friends — and helps them build a contact list they would never put together on their own. Volunteers do not need to fill out forms, navigate menus, or learn a new interface. They just talk to the AI coach and it records everything in the app for them, including contact information, voter file matches, and outreach outcomes.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">3. Account Registration</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>You must be at least 18 years of age to create an account.</li>
              <li>You must provide accurate and complete information during registration.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You must notify us immediately if you become aware of any unauthorized use of your account.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">4. Acceptable Use</h2>
            <p className="mb-3">You agree to use Threshold only for lawful civic engagement purposes. You may not:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Use the platform to harass, intimidate, or threaten any individual</li>
              <li>Submit false, misleading, or fraudulent information</li>
              <li>Attempt to suppress voter participation or spread disinformation</li>
              <li>Use the platform to violate any applicable federal, state, or local election laws</li>
              <li>Interfere with or disrupt the platform&rsquo;s infrastructure or other users&rsquo; access</li>
              <li>Scrape, harvest, or extract data from the platform through automated means</li>
              <li>Resell, redistribute, or sublicense access to the platform without authorization</li>
              <li>Use voter file data for commercial purposes unrelated to civic engagement</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">5. Voter File Data</h2>
            <p className="mb-3">
              Threshold accesses publicly available voter registration records maintained by state election authorities. By using the platform, you acknowledge and agree that:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Voter file data is public record and includes names, addresses, party affiliation, and voting history (whether someone voted, not how they voted).</li>
              <li>You will use voter file data solely for lawful civic engagement, voter outreach, and campaign-related purposes.</li>
              <li>You will not use voter file data to harass, stalk, or intimidate any individual.</li>
              <li>You will comply with all applicable state laws governing the use of voter registration data, which vary by jurisdiction.</li>
              <li>Voter file matching results are provided as potential matches and may contain inaccuracies. You are responsible for verifying match accuracy.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">6. AI-Powered Features</h2>
            <p className="mb-3">
              Threshold Relational includes an AI chat assistant powered by third-party AI services. By using these features, you acknowledge and agree that:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>The AI assistant records contact information and outreach data in the platform on your behalf based on your conversation.</li>
              <li>AI-generated coaching suggestions and conversation guidance are recommendations only and do not constitute professional advice.</li>
              <li>You are solely responsible for the accuracy of information you provide to the AI assistant and for verifying any voter file matches it presents.</li>
              <li>AI responses may occasionally contain errors or inaccuracies. You should review all data recorded by the assistant.</li>
              <li>Conversation data with the AI assistant may be processed by our third-party AI provider in accordance with our <Link href="/privacy" className="text-vc-purple-light hover:underline">Privacy Policy</Link>.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">7. Campaign Organizations</h2>
            <p className="mb-3">
              If you create or administer a campaign organization on Threshold:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>You are responsible for ensuring your campaign&rsquo;s use of the platform complies with all applicable election laws and regulations.</li>
              <li>You are responsible for the conduct of volunteers and team members you invite to your organization.</li>
              <li>You acknowledge that aggregated volunteer activity data (contacts added, outreach outcomes) is visible to campaign administrators.</li>
              <li>You may not use organizational admin privileges to access individual volunteers&rsquo; personal account information beyond campaign activity data.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">8. Subscriptions and Payments</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Certain features require a paid subscription. Pricing and plan details are listed on our pricing page.</li>
              <li>Subscriptions are billed on a recurring basis (monthly or annually) as selected at the time of purchase.</li>
              <li>You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period.</li>
              <li>We reserve the right to modify pricing with 30 days&rsquo; notice. Existing subscribers will be notified before any price changes take effect.</li>
              <li>Refunds are handled on a case-by-case basis. Contact us at <a href="mailto:info@thresholdvote.com" className="text-vc-purple-light hover:underline">info@thresholdvote.com</a> for refund requests.</li>
              <li>Free-tier usage is subject to the limits described on our pricing page and may be modified at our discretion.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">9. Intellectual Property</h2>
            <p>
              The Threshold platform, including its design, features, code, and content, is owned by Vote Threshold LLC and protected by applicable intellectual property laws. You retain ownership of any data you input into the platform (contact lists, notes, outreach records). By using the platform, you grant us a limited license to process your data solely to provide and improve our services.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">10. Disclaimers</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>The platform is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, whether express or implied.</li>
              <li>We do not guarantee that voter file data is complete, accurate, or current. Voter records are maintained by state authorities and may contain errors or be outdated.</li>
              <li>We do not guarantee the accuracy of AI-generated suggestions, match results, or coaching guidance.</li>
              <li>We are not responsible for the outcome of any voter outreach, campaign activity, or election result.</li>
              <li>We do not provide legal, political strategy, or compliance advice. Consult qualified professionals for campaign finance and election law questions.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">11. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Vote Threshold LLC and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the platform. Our total liability for any claim arising under these Terms shall not exceed the amount you paid us in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">12. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Vote Threshold LLC from any claims, damages, losses, or expenses (including reasonable attorney&rsquo;s fees) arising from your use of the platform, your violation of these Terms, or your violation of any applicable law or regulation.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">13. Termination</h2>
            <p>
              We may suspend or terminate your access to the platform at any time for violation of these Terms or for any other reason at our sole discretion. Upon termination, your right to use the platform ceases immediately. You may request export of your data prior to account deletion by contacting us.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">14. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of North Carolina, without regard to conflict of law provisions. Any disputes arising under these Terms shall be resolved in the state or federal courts located in North Carolina.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">15. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes by posting a notice on the platform or sending an email to your registered address. Your continued use of the platform after changes take effect constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold text-white mb-3">16. Contact Us</h2>
            <p>
              If you have questions about these Terms of Service, please contact us at:
            </p>
            <div className="mt-3 glass-card p-4 text-sm">
              <p className="text-white font-bold">Vote Threshold LLC</p>
              <p>Email: <a href="mailto:info@thresholdvote.com" className="text-vc-purple-light hover:underline">info@thresholdvote.com</a></p>
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
