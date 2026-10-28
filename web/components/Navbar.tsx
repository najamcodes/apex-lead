import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#09090b]/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-white text-lg tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <span>ApexLead</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            SaaS
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-300">
          <Link href="/#features" className="hover:text-white transition">Features</Link>
          <Link href="/vs/apollo" className="hover:text-white transition">vs Apollo.io</Link>
          <Link href="/vs/zoominfo" className="hover:text-white transition">vs ZoomInfo</Link>
          <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
          <Link href="/dashboard" className="hover:text-white transition">App</Link>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-neutral-300 hover:text-white transition px-3 py-1.5"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </nav>
  )
}
