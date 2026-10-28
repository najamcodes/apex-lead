import Link from 'next/link'
import { ArrowRight, Play, Sparkles, CheckCircle2, ShieldCheck, MapPin, Mail, Phone, Cpu } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative pt-36 pb-20 overflow-hidden">
      {/* Background Radial Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-indigo-600/15 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[300px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 text-center space-y-8 relative z-10">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-indigo-400 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Next-Gen Sales Intelligence • Beyond Apollo & ZoomInfo</span>
        </div>

        {/* Primary Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-white max-w-4xl mx-auto leading-[1.08]">
          Stop Buying Stale Data.{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            Scrape & Verify Live Leads.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
          The modern outbound intelligence platform. Scrape Google Maps & B2B directories in real-time, enrich with multi-provider waterfall cascades, and dispatch autonomous voice AI callers.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/25 text-base"
          >
            <span>Start Free with Google</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/pricing"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-neutral-300 font-semibold border border-white/10 transition flex items-center justify-center gap-2 text-base backdrop-blur-md"
          >
            <span>View Pricing & ROI</span>
          </Link>
        </div>

        {/* Guarantees */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            50 Free Leads Monthly
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            No Credit Card Required
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            100% Real-Time Live Data
          </span>
        </div>

        {/* Live Pipeline Simulator Card */}
        <div className="pt-8 max-w-4xl mx-auto">
          <div className="rounded-2xl border border-white/10 bg-[#121217]/90 backdrop-blur-xl p-5 shadow-2xl text-left space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-mono text-neutral-500 ml-2">apexlead-live-pipeline.dag</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Pipeline Active • Realtime
              </div>
            </div>

            {/* Pipeline Stage Visualizer */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>1. Live Scrape</span>
                </div>
                <div className="text-white font-medium">Google Maps & Clutch</div>
                <div className="text-[10px] text-neutral-500 font-mono">142 places extracted</div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-purple-400 font-semibold">
                  <Mail className="w-3.5 h-3.5" />
                  <span>2. Waterfall Verify</span>
                </div>
                <div className="text-white font-medium">Hunter → Prospeo → Drop</div>
                <div className="text-[10px] text-neutral-500 font-mono">98.4% deliverability</div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>3. Technographics</span>
                </div>
                <div className="text-white font-medium">Shopify, Stripe, React</div>
                <div className="text-[10px] text-neutral-500 font-mono">Tech stack radar</div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Phone className="w-3.5 h-3.5" />
                  <span>4. Voice AI SDR</span>
                </div>
                <div className="text-white font-medium">Autonomous Call</div>
                <div className="text-[10px] text-emerald-300 font-mono">Meeting Booked 🔥</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
