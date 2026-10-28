import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import Link from 'next/link'
import { ShieldCheck, FileText } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service | ApexLead',
  description: 'Terms of Service, acceptable use guidelines, and compliance standards for ApexLead.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 selection:bg-indigo-500 selection:text-white flex flex-col">
      <Navbar />

      <main className="flex-1 pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-6 space-y-12">
          {/* Header */}
          <div className="space-y-4 border-b border-white/10 pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
              <FileText className="w-3.5 h-3.5" />
              <span>Legal Agreement</span>
            </div>
            <h1 className="text-4xl font-black text-white">Terms of Service</h1>
            <p className="text-neutral-400 text-sm">
              Last updated: October 2026 • Effective immediately across all ApexLead services and desktop workers.
            </p>
          </div>

          {/* Legal Text */}
          <div className="prose prose-invert prose-neutral max-w-none space-y-8 text-neutral-300 text-sm leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">1. Nature of the Service</h2>
              <p>
                ApexLead (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;) provides automated software tools, scraping utilities, and verification APIs designed to aggregate and enrich publicly accessible B2B commercial contact information from directories, public maps, and business websites.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">2. Acceptable Use & Anti-Spam Compliance</h2>
              <p>
                Users agree to use all extracted contact data in strict compliance with all applicable local, national, and international laws, including but not limited to the United States CAN-SPAM Act, Canada Anti-Spam Legislation (CASL), and the European Union General Data Protection Regulation (GDPR).
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-neutral-400">
                <li>You must include clear, functioning unsubscribe or opt-out mechanisms in all outreach communications.</li>
                <li>You must not use automated dialers or voice AI callers to contact individuals on official National Do Not Call (DNC) registries without prior express consent.</li>
                <li>You may not use the Service to harvest non-commercial consumer data, medical records, or sensitive personal data.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">3. Data Ownership & Pipeline Rights</h2>
              <p>
                You retain complete, unencumbered ownership of all data files, lists, and workflows you generate or export using ApexLead. ApexLead claims no intellectual property ownership over your exported CSV, JSON, or CRM-synced records.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">4. Billing, Subscriptions & Merchant of Record</h2>
              <p>
                All digital subscriptions, memberships, and quota upgrades are billed via our Merchant of Record, <strong>Polar.sh</strong>. Subscriptions are billed on a recurring monthly or annual basis until canceled. You may cancel your subscription at any time via your account portal, with service access remaining active through the conclusion of the paid billing interval.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">5. Limitation of Liability</h2>
              <p>
                ApexLead provides its platform on an &quot;as is&quot; and &quot;as available&quot; basis. In no event shall ApexLead be liable for indirect, incidental, special, or consequential damages resulting from the use or inability to use the service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-white">6. Contact Information</h2>
              <p>
                For questions regarding these Terms, please contact our legal team at{' '}
                <a href="mailto:legal@apexlead.ai" className="text-indigo-400 underline">
                  legal@apexlead.ai
                </a>.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
