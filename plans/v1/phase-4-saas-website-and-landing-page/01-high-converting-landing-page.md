# Phase 4 — Prompt 01: High-Converting SaaS Landing Page

> **Objective:** Design and implement a world-class, high-converting Next.js 15 landing page (`web/app/page.tsx`) that immediately differentiates ApexLead from Apollo.io and drives self-service signups.

---

## 1. Design Aesthetics & Visual Identity Guidelines

- **Theme:** Sleek, futuristic dark mode (`#09090b` background with glassmorphic cards and subtle `#6366f1` / `#8b5cf6` indigo-violet gradients).
- **Typography:** Geist / Inter sans-serif with bold display headings.
- **Micro-Animations:** Smooth hover states, glowing border accents, live pulsing pipeline execution signals.
- **Zero Generic Placeholders:** Real preview animations showcasing live Google Maps extraction and AI decision trees.

---

## 2. Core Landing Page Sections

```
┌────────────────────────────────────────────────────────────────────────┐
│ NAVBAR: Logo, Features, Comparison vs Apollo, Pricing, Docs, [Get Started]│
├────────────────────────────────────────────────────────────────────────┤
│ HERO SECTION:                                                          │
│ "Stop Buying Stale B2B Data.                                          │
│  Scrape, Verify & Auto-Close Leads in Real-Time."                     │
│ [Start Free with Google]  [Watch 2-Min Demo]                          │
│                                                                        │
│ Interactive Live Scraper & Visual Pipeline Simulator Preview Card      │
├────────────────────────────────────────────────────────────────────────┤
│ SOCIAL PROOF: Logos of high-growth agencies & outbound teams           │
├────────────────────────────────────────────────────────────────────────┤
│ THE REALITY GAP: Why Apollo & ZoomInfo Fail in 2026                    │
│ Static Database (40% Bounces) vs Live Multi-Directory Scraper (Fresh) │
├────────────────────────────────────────────────────────────────────────┤
│ INTERACTIVE PIPELINE BUILDER PREVIEW: Drag-and-drop workflow showcase  │
├────────────────────────────────────────────────────────────────────────┤
│ FEATURE MATRIX:                                                        │
│ - Live Maps & Directory Scraping   - Multi-Step Waterfall Enrichment   │
│ - Deep Technographic Radar         - Autonomous Voice AI SDR           │
├────────────────────────────────────────────────────────────────────────┤
│ COMPARISON TABLE: ApexLead vs Apollo vs ZoomInfo vs PhantomBuster      │
├────────────────────────────────────────────────────────────────────────┤
│ INTERACTIVE ROI CALCULATOR: "How much are you spending per lead?"      │
├────────────────────────────────────────────────────────────────────────┤
│ FREQUENTLY ASKED QUESTIONS (Accordion)                                 │
├────────────────────────────────────────────────────────────────────────┤
│ FINAL CTA BANNER & FOOTER                                              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. High-Conversion Hero Component (`web/components/landing/HeroSection.tsx`)

```tsx
import Link from 'next/link'
import { ArrowRight, Play, Sparkles, CheckCircle2 } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-500/15 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 text-center space-y-8 relative z-10">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-indigo-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Next-Gen Sales Intelligence • Beyond Apollo.io</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
          Stop Buying Stale Data.{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            Scrape & Verify Live Leads.
          </span>
        </h1>

        {/* Subhead */}
        <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
          The all-in-one outbound platform combining live multi-directory scraping, 
          waterfall email verification, technographic radar, and autonomous voice AI callers.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
          >
            Start Free with Google
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 font-semibold border border-white/10 transition flex items-center justify-center gap-2">
            <Play className="w-4 h-4 text-indigo-400" />
            Watch 2-Min Demo
          </button>
        </div>

        {/* Guarantees */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 50 Free Leads Monthly</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> No Credit Card Required</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 100% Real-Time Live Data</span>
        </div>
      </div>
    </section>
  )
}
```

---

## 4. Competitor Comparison Table Component

```tsx
// web/components/landing/ComparisonTable.tsx
export function ComparisonTable() {
  const features = [
    { name: 'Live On-Demand Web Scraping', apex: true, apollo: false, zoominfo: false },
    { name: 'Visual Drag & Drop DAG Pipelines', apex: true, apollo: false, zoominfo: false },
    { name: 'Autonomous Voice AI SDR Caller', apex: true, apollo: false, zoominfo: false },
    { name: 'Waterfall B2B Email Verification', apex: true, apollo: true, zoominfo: true },
    { name: 'Zero-Cloud-Cost Desktop Worker Mode', apex: true, apollo: false, zoominfo: false },
    { name: 'Deep Live Technographic Detection', apex: true, apollo: 'Static', zoominfo: 'Static' },
    { name: 'Starting Price', apex: '$29/mo', apollo: '$49/mo', zoominfo: '$15,000/yr' },
  ]
  // Renders comparative grid with emerald checks vs red crosses
}
```

---

## 5. Verification Protocol
- [ ] Responsive test across Mobile (375px), Tablet (768px), and Desktop (1440px).
- [ ] Lighthouse score: Performance > 90, Accessibility > 95, SEO > 95.
- [ ] Click "Start Free with Google" -> Navigates cleanly to Google OAuth gateway.
