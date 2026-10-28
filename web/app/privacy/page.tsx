import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { ShieldCheck, Lock } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy | ApexLead',
  description: 'Privacy Policy, data controller obligations, and GDPR / CCPA opt-out procedures for ApexLead.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 selection:bg-indigo-500 selection:text-white flex flex-col">
      <Navbar />

      <main className="flex-1 pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-6 space-y-12">
          {/* Header */}
          <div className="space-y-4 border-b border-white/10 pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Data Protection</span>
            </div>
            <h1 className="text-4xl font-black text-white">Privacy Policy</h1>
            <p className="text-neutral-400 text-sm">
              Last updated: October 2026 • Compliant with GDPR, CCPA/CPRA, and Canadian PIPEDA.
            </p>
          </div>

          {/* Privacy Text */}
          <div className="prose prose-invert prose-neutral max-w-none space-y-8 text-neutral-300 text-sm leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">1. Data Controller vs. Data Processor Roles</h2>
              <p>
                ApexLead acts as a <strong>Data Controller</strong> with respect to your customer account details (e.g., email address, payment status, usage statistics). ApexLead acts as a <strong>Data Processor</strong> when executing live scraping pipelines and storing enriched B2B contact records on your organization&apos;s behalf.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">2. Scope of Public B2B Contact Information</h2>
              <p>
                Our scraping tools and waterfall enrichment cascades only process publicly discoverable business contacts associated with commercial enterprises, including business names, business addresses, verified corporate email addresses, and public phone numbers. We do not knowingly crawl or maintain private consumer records.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">3. Security & Multi-Tenant Data Isolation</h2>
              <p>
                Every customer account is strictly isolated using row-level tenant keys and encrypted storage. Passwords are hash-protected using Argon2id/PBKDF2. Payment transactions are never processed on our servers; they are managed entirely through PCI-DSS Level 1 compliant infrastructure provided by Polar.sh.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">4. Right to Erasure & Contact Opt-Out</h2>
              <p>
                Under GDPR and CCPA, any individual or business representative has the right to request the inspection or permanent deletion of their business record from our cache. To submit an erasure or opt-out request, email{' '}
                <a href="mailto:privacy@apexlead.ai" className="text-indigo-400 underline">
                  privacy@apexlead.ai
                </a>
                . All requests are processed within 48 business hours.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">5. Cookies & Analytics</h2>
              <p>
                We use strictly necessary session cookies to maintain your login status and protect against CSRF attacks. We do not sell user data to advertising brokers.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
