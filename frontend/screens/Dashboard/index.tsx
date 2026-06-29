// src/screens/Dashboard/index.tsx
import { useEffect, useState } from 'react'
import { Users, Globe, AlertTriangle, CheckCircle, DollarSign, Clock, MailCheck, Link as LinkIcon } from 'lucide-react'
import { StatCard } from './StatCard'
import { WeeklyChart } from './WeeklyChart'
import { PipelineChart } from './PipelineChart'
import { ActivityFeed } from './ActivityFeed'
import { CityRoiStats } from './CityRoiStats'
import type { DashboardStats } from '../../../shared/types'
import { useNavigate } from 'react-router-dom'
import { useLeadsStore } from '../../store/leads.store'
import { motion } from 'framer-motion'
import { api } from '../../services/api'

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const navigate = useNavigate()
  const { setFilters } = useLeadsStore()

  useEffect(() => {
    api.stats.getDashboard().then(setStats)
  }, [])

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 font-sans text-sm">Loading dashboard stats...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="font-sans">
        <h2 className="text-lg font-semibold text-zinc-100">Overview</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Your lead pipeline at a glance</p>
      </div>

      <motion.div 
        className="grid grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ staggerChildren: 0.1, duration: 0.4 }}
      >
        <StatCard 
          label="Total Leads" 
          value={stats.total_leads} 
          icon={Users} 
          onClick={() => {
            setFilters({})
            navigate('/leads')
          }}
        />
        <StatCard 
          label="No Website" 
          value={stats.no_website} 
          icon={Globe} 
          accent="text-red-400" 
          onClick={() => {
            setFilters({ website_status: 'none' })
            navigate('/leads')
          }}
        />
        <StatCard
          label="Outdated Site"
          value={stats.outdated_website}
          icon={AlertTriangle}
          accent="text-amber-400"
          onClick={() => {
            setFilters({ website_status: 'outdated' })
            navigate('/leads')
          }}
        />

        <StatCard 
          label="In Review" 
          value={stats.in_review} 
          icon={Clock} 
          accent="text-blue-400" 
          onClick={() => {
            setFilters({ status: 'review' })
            navigate('/leads')
          }}
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          icon={CheckCircle}
          accent="text-emerald-400"
          onClick={() => {
            setFilters({ status: 'approved' })
            navigate('/leads')
          }}
        />
        <StatCard 
          label="Closed" 
          value={stats.closed} 
          icon={DollarSign} 
          accent="text-green-400" 
          onClick={() => {
            setFilters({ status: 'closed' })
            navigate('/leads')
          }}
        />
        <StatCard 
          label="Verified Emails" 
          value={stats.verified_emails} 
          icon={MailCheck} 
          accent="text-pink-400" 
          onClick={() => {
            setFilters({ email_verified: true })
            navigate('/leads')
          }}
        />
        <StatCard 
          label="Socials Found" 
          value={stats.social_links_found} 
          icon={LinkIcon} 
          accent="text-purple-400" 
          // Currently no 'has_socials' filter, but wired for future
          onClick={() => {
            navigate('/leads')
          }}
        />
      </motion.div>

      <div className="glass-panel rounded-xl p-5 font-sans">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">This week</p>
        <p className="text-4xl font-semibold text-slate-100">{stats.this_week}</p>
        <p className="text-sm text-slate-500 mt-1">new leads scraped</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4">
          <WeeklyChart />
          <PipelineChart />
        </div>
        <div className="space-y-4">
          <CityRoiStats />
          <ActivityFeed />
        </div>
      </div>
    </div>
  )
}
