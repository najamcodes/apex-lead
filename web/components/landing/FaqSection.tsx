'use client'

import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const faqs = [
    {
      q: 'Why is live scraped data superior to Apollo.io or ZoomInfo?',
      a: 'Apollo and ZoomInfo maintain static databases scraped months ago. 30% of business professionals change roles, emails, or phone numbers annually, resulting in 20-30% bounce rates and wasted sales hours. ApexLead queries Google Maps, Yelp, Houzz, and B2B directories in real-time when you run a pipeline, guaranteeing 100% active, current listings.',
    },
    {
      q: 'How does Multi-Provider Waterfall Enrichment prevent email bounces?',
      a: 'Instead of relying on a single database, ApexLead routes each prospect through Hunter, Prospeo, and Dropcontact sequentially. The moment an email is identified, we perform a zero-send MX record check and SMTP handshake. If an email is catch-all or risky, we cascade to the next provider until a verified mailbox is confirmed, keeping bounces strictly below 2%.',
    },
    {
      q: 'What is Hybrid Edge Desktop Worker Mode?',
      a: 'Headless browser scraping (Playwright/Puppeteer) consumes heavy server RAM and expensive residential proxies in the cloud. ApexLead gives you the freedom to run high-volume browser extraction directly on your local computer using your own IP or proxies at zero additional cloud cost. You only pay for cloud resources when you choose cloud execution.',
    },
    {
      q: 'How does the Autonomous Voice AI SDR Caller function?',
      a: 'Our voice agent leverages Gemini Live 3.8 and WebRTC to achieve human-level conversational latency (under 300 milliseconds). You configure qualifying questions and calendar booking links. The AI calls your verified leads, handles gatekeepers, answers FAQs naturally, qualifies interest, and books demos directly into your sales reps Google Calendar.',
    },
    {
      q: 'Can I bring my own proxies and API keys?',
      a: 'Yes. On all plans (including Free and Starter), you can plug in your own BrightData, Oxylabs, or generic HTTP/SOCKS5 proxy pools, as well as your personal Hunter or OpenAI/Gemini API keys, saving your monthly quota.',
    },
    {
      q: 'How does Polar.sh billing work? Can I cancel anytime?',
      a: 'All subscriptions are billed securely through Polar.sh as the Merchant of Record. There are zero multi-year lock-ins or hidden cancellation fees. You can upgrade, downgrade, or cancel directly from your customer portal with 1 click at any time.',
    },
  ]

  return (
    <section id="faq" className="py-24 relative z-10 border-t border-white/5 bg-neutral-950/80">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-neutral-400 text-base md:text-lg">
            Everything you need to know about our data engine, architecture, and billing.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index
            return (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-white/[0.02] transition"
                >
                  <span className="font-semibold text-white text-base md:text-lg">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-neutral-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-indigo-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-sm md:text-base text-neutral-400 leading-relaxed border-t border-white/5 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
