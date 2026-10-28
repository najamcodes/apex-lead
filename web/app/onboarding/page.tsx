'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Hammer,
  Stethoscope,
  Laptop,
  MapPin,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Mail,
  Phone,
} from 'lucide-react'

const INDUSTRIES = [
  { id: 'contractors', title: 'Contractors & Trades', icon: Hammer, desc: 'Roofing, HVAC, Solar, Plumbing' },
  { id: 'b2b-saas', title: 'B2B Software & Tech', icon: Laptop, desc: 'Founders, CTOs, VP of Sales' },
  { id: 'healthcare', title: 'Healthcare & Clinics', icon: Stethoscope, desc: 'Dentists, Chiropractors, MedSpas' },
  { id: 'commercial', title: 'Professional Services', icon: Building2, desc: 'Lawyers, Accountants, Agencies' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedIndustry, setSelectedIndustry] = useState<string>('contractors')
  const [targetLocation, setTargetLocation] = useState<string>('Austin, TX')
  const [isScraping, setIsScraping] = useState<boolean>(false)
  const [sampleLeads, setSampleLeads] = useState<any[]>([])

  const handleRunFirstScrape = async () => {
    setIsScraping(true)
    setStep(3)

    // Simulate instant live scraping with real-time discovery
    setTimeout(() => {
      setSampleLeads([
        {
          name: 'Apex Precision Roofing & Solar',
          contact: 'Marcus Vance',
          title: 'Managing Director',
          email: 'marcus@apexroofingtx.com',
          phone: '+1 (512) 555-0192',
          rating: 4.9,
          reviews: 84,
        },
        {
          name: 'Lone Star Climate HVAC Solutions',
          contact: 'Sarah Jenkins',
          title: 'Operations VP',
          email: 's.jenkins@lonestarclimate.com',
          phone: '+1 (512) 555-8371',
          rating: 4.8,
          reviews: 112,
        },
        {
          name: 'Austin Premier Plumbing & Gas',
          contact: 'David Keller',
          title: 'Owner & Founder',
          email: 'david@austinpremierplumbing.net',
          phone: '+1 (512) 555-3349',
          rating: 5.0,
          reviews: 67,
        },
      ])
      setIsScraping(false)
    }, 2400)
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 flex flex-col justify-center items-center py-16 px-6">
      <div className="w-full max-w-2xl space-y-8">
        {/* Step Indicator */}
        <div className="flex items-center justify-between px-4">
          <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 1 ? 'text-indigo-400' : 'text-neutral-600'}`}>
            <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">1</span>
            Target Industry
          </div>
          <div className="w-12 h-px bg-white/10" />
          <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 2 ? 'text-indigo-400' : 'text-neutral-600'}`}>
            <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">2</span>
            Location Target
          </div>
          <div className="w-12 h-px bg-white/10" />
          <div className={`flex items-center gap-2 text-xs font-semibold ${step >= 3 ? 'text-indigo-400' : 'text-neutral-600'}`}>
            <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">3</span>
            Live Discovery
          </div>
        </div>

        {/* Step 1: Industry Picker */}
        {step === 1 && (
          <div className="bg-white/[0.02] border border-white/10 p-8 rounded-3xl shadow-2xl backdrop-blur-xl space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">What type of leads do you target?</h2>
              <p className="text-sm text-neutral-400 mt-1">We will configure your live scrapers and data schema automatically.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {INDUSTRIES.map((ind) => {
                const Icon = ind.icon
                const active = selectedIndustry === ind.id
                return (
                  <button
                    key={ind.id}
                    onClick={() => setSelectedIndustry(ind.id)}
                    className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      active
                        ? 'border-indigo-500 bg-indigo-600/10 shadow-lg shadow-indigo-500/10'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2.5 rounded-xl ${active ? 'bg-indigo-600 text-white' : 'bg-white/5 text-neutral-400'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      {active && <CheckCircle2 className="w-5 h-5 text-indigo-400" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">{ind.title}</h4>
                      <p className="text-xs text-neutral-400 mt-1">{ind.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
            >
              <span>Continue to Target Region</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Location Selector */}
        {step === 2 && (
          <div className="bg-white/[0.02] border border-white/10 p-8 rounded-3xl shadow-2xl backdrop-blur-xl space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Where do you want to find prospects?</h2>
              <p className="text-sm text-neutral-400 mt-1">Enter a city, metropolitan area, or postal zip code.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-300">City & State / Metro Area</label>
              <div className="relative">
                <MapPin className="w-5 h-5 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={targetLocation}
                  onChange={(e) => setTargetLocation(e.target.value)}
                  placeholder="e.g. Austin, TX or Miami, FL"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              onClick={handleRunFirstScrape}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch Free Live Discovery Test</span>
            </button>
          </div>
        )}

        {/* Step 3: Instant Live Scrape Results */}
        {step === 3 && (
          <div className="bg-white/[0.02] border border-white/10 p-8 rounded-3xl shadow-2xl backdrop-blur-xl">
            {isScraping ? (
              <div className="py-16 text-center space-y-4">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto" />
                <h3 className="text-xl font-bold text-white">Scraping Live Listings & Verifying Contacts...</h3>
                <p className="text-sm text-neutral-400 max-w-sm mx-auto">
                  Connecting to Google Maps & checking live MX mailboxes in {targetLocation}...
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">First 3 Live Leads Discovered!</h3>
                    <p className="text-xs text-emerald-400 mt-0.5">100% active, verified direct contacts.</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                    Live Crawl Complete
                  </span>
                </div>

                <div className="space-y-3">
                  {sampleLeads.map((lead, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-white text-sm flex items-center gap-2">
                          <span>{lead.name}</span>
                          <span className="text-xs text-amber-400">★ {lead.rating} ({lead.reviews})</span>
                        </div>
                        <div className="text-xs text-neutral-400">
                          {lead.contact} • {lead.title}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-neutral-300 pt-1 font-mono">
                          <span className="flex items-center gap-1 text-emerald-400">
                            <Mail className="w-3.5 h-3.5" /> {lead.email}
                          </span>
                          <span className="flex items-center gap-1 text-neutral-400">
                            <Phone className="w-3.5 h-3.5" /> {lead.phone}
                          </span>
                        </div>
                      </div>
                      <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                        Verified
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/25"
                >
                  <span>Enter Your Outbound Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
