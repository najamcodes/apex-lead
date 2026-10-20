'use client';
// src/components/layout/Sidebar.tsx
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Settings,
  ChevronLeft,
  Target,
  Search,
  ListTodo,
  Send,
  Sun,
  Moon,
  BookOpen,
  GitBranch,
  Building2,
  ChevronsUpDown,
  Server,
  Database,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react'
import { useAppStore } from '../../store/app.store'
import { useThemeStore } from '../../store/theme.store'
import { useAuthStore, canManageOrg, roleLevel } from '../../store/auth.store'
import { useState } from 'react'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', perm: null, minRole: null },
  { to: '/leads', icon: Users, label: 'Leads', perm: 'view_leads', minRole: null },
  { to: '/scraper', icon: Search, label: 'Scraper', perm: 'run_scraper', minRole: null },
  { to: '/review', icon: ListTodo, label: 'Review', perm: 'view_leads', minRole: null },
  { to: '/outreach', icon: Send, label: 'Outreach', perm: 'send_outreach', minRole: null },
  { to: '/pipelines', icon: GitBranch, label: 'Pipelines', perm: null, minRole: null },
  { to: '/approvals', icon: ShieldCheck, label: 'Approvals', perm: null, minRole: null },
  { to: '/data-studio', icon: Database, label: 'Data Studio', perm: null, minRole: null },
  { to: '/analytics', icon: TrendingUp, label: 'Analytics & ROI', perm: null, minRole: null },
  { to: '/workers', icon: Server, label: 'Worker Farm', perm: null, minRole: null },
  { to: '/tutorial', icon: BookOpen, label: 'Tutorial', perm: null, minRole: null },
  { to: '/settings', icon: Settings, label: 'Settings', perm: null, minRole: null },
  { to: '/orgs', icon: Building2, label: 'Organizations', perm: null, minRole: 'super_admin' },
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const { theme, setTheme } = useThemeStore()
  const { role, permissions, organizations, orgId, switchOrg } = useAuthStore()
  const location = useLocation()
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
  
  const filteredNav = NAV_ITEMS.filter(item => {
    // Filter by minRole (e.g., super_admin only items)
    if (item.minRole && roleLevel(role ?? 'user') < roleLevel(item.minRole)) return false
    // Filter by permission
    if (!item.perm) return true
    if (canManageOrg(role ?? 'user')) return true // org_admin+ sees everything
    return permissions.includes(item.perm)
  })

  const currentOrg = organizations.find(o => o.id === orgId)

  return (
    <aside
      className={`
      flex flex-col bg-slate-950/40 backdrop-blur-xl border-r border-slate-800/50
      transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] z-20
      ${sidebarCollapsed ? 'w-14' : 'w-52'}
    `}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-zinc-800/50 h-14 font-sans">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
          <Target className="w-3.5 h-3.5 text-white" />
        </div>
        {!sidebarCollapsed && (
          <span className="text-sm font-semibold text-zinc-100 tracking-tight">ApexLead</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-1 font-sans relative">
        {filteredNav.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className={`
                relative flex items-center gap-2.5 px-3 py-2.5 rounded-md
                text-sm transition-colors duration-200 z-10
                ${
                  isActive
                    ? 'text-emerald-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-pill"
                  className="absolute inset-0 bg-emerald-500/10 border border-emerald-500/20 rounded-md -z-10"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Org Switcher */}
      {organizations.length > 1 && (
        <div className="px-2 pb-1 relative">
          <button
            onClick={() => setOrgDropdownOpen(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition-all duration-200"
          >
            <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 truncate text-left">{currentOrg?.name ?? 'Org'}</span>
                <ChevronsUpDown className="w-3 h-3 flex-shrink-0" />
              </>
            )}
          </button>
          {orgDropdownOpen && !sidebarCollapsed && (
            <div className="absolute bottom-full left-2 right-2 mb-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-50">
              <div className="px-3 py-2 text-xs font-medium text-zinc-500 border-b border-zinc-800">Switch Organization</div>
              {organizations.map(org => (
                <button
                  key={org.id}
                  onClick={() => { switchOrg(org.id); setOrgDropdownOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-zinc-800 transition-colors ${
                    org.id === orgId ? 'text-emerald-400' : 'text-zinc-300'
                  }`}
                >
                  <Building2 className="w-3 h-3 flex-shrink-0" />
                  <span className="flex-1 truncate">{org.name}</span>
                  {org.id === orgId && <span className="text-emerald-500 text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t border-zinc-800/50 font-sans flex flex-col gap-1">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center justify-center py-2 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-all duration-200"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center py-2 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-all duration-200"
        >
          <ChevronLeft
            className={`w-4 h-4 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
    </aside>
  )
}
