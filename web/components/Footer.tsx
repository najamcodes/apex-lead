import Link from 'next/link'
import { Sparkles, Shield, Heart } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#09090b] text-neutral-400 py-16 text-sm">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-5 gap-10">
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-2 font-bold text-white text-lg">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span>ApexLead</span>
          </div>
          <p className="text-neutral-400 max-w-sm leading-relaxed text-xs">
            Next-generation autonomous lead generation, multi-directory live web scrapers, waterfall verification, and AI SDR callers. Built for agencies and high-velocity sales teams.
          </p>
          <div className="flex items-center gap-2 text-xs text-neutral-500 pt-2">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>SOC-2 & GDPR compliant data extraction practices</span>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">Product</h4>
          <ul className="space-y-2 text-xs">
            <li><Link href="/#features" className="hover:text-white transition">Live Scrapers</Link></li>
            <li><Link href="/#features" className="hover:text-white transition">Waterfall Verification</Link></li>
            <li><Link href="/#features" className="hover:text-white transition">Technographic Radar</Link></li>
            <li><Link href="/#features" className="hover:text-white transition">Voice AI SDR Caller</Link></li>
            <li><Link href="/pricing" className="hover:text-white transition">Commercial Pricing</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">Comparisons</h4>
          <ul className="space-y-2 text-xs">
            <li><Link href="/vs/apollo" className="hover:text-white transition">vs Apollo.io Alternative</Link></li>
            <li><Link href="/vs/zoominfo" className="hover:text-white transition">vs ZoomInfo Alternative</Link></li>
            <li><Link href="/pricing" className="hover:text-white transition">ROI Cost Calculator</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">Legal & Trust</h4>
          <ul className="space-y-2 text-xs">
            <li><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></li>
            <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
            <li><Link href="/terms#scraping" className="hover:text-white transition">CFAA & Scraping Ethics</Link></li>
            <li><Link href="/privacy#dnc" className="hover:text-white transition">DNC Suppression</Link></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-12 mt-12 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
        <div>© {new Date().getFullYear()} ApexLead Inc. All rights reserved.</div>
        <div className="flex items-center gap-1">
          <span>Engineered with precision for modern outbound teams</span>
        </div>
      </div>
    </footer>
  )
}
