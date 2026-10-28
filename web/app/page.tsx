import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { HeroSection } from '@/components/landing/HeroSection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { ComparisonSection } from '@/components/landing/ComparisonSection'
import { LeadCalculator } from '@/components/pricing/LeadCalculator'
import { FaqSection } from '@/components/landing/FaqSection'
import Link from 'next/link'
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 selection:bg-indigo-500 selection:text-white flex flex-col">
      {/* SaaS Sticky Navbar */}
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <HeroSection />

        {/* Feature Highlights Grid */}
        <FeaturesSection />

        {/* Head-to-Head Comparison vs Apollo, ZoomInfo, PhantomBuster */}
        <ComparisonSection />

        {/* Interactive ROI & Lead Cost Savings Calculator */}
        <section id="calculator" className="py-24 relative z-10 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6">
            <LeadCalculator />
          </div>
        </section>

        {/* FAQ Section */}
        <FaqSection />

        {/* Final CTA Banner */}
        <section className="py-20 relative z-10 border-t border-white/5 bg-gradient-to-b from-transparent to-indigo-950/20">
          <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ready To Scale Outbound?</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
              Start Generating Live Verified Leads Today
            </h2>
            <p className="text-neutral-400 max-w-xl mx-auto text-base sm:text-lg">
              Join hundreds of high-growth sales teams running live scrapers and AI callers with zero stale data.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/25 text-base"
              >
                <span>Get Started Free — 50 Leads</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-neutral-300 font-semibold border border-white/10 transition flex items-center justify-center gap-2 text-base"
              >
                <span>Compare Plans</span>
              </Link>
            </div>
            <div className="flex items-center justify-center gap-6 pt-2 text-xs text-neutral-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> No credit card needed
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Cancel anytime
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Global Footer */}
      <Footer />
    </div>
  )
}
