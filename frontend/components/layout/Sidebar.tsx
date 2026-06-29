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
  Workflow,
  Sun,
  Moon,
  BookOpen,
  GitBranch
} from 'lucide-react'
import { useAppStore } from '../../store/app.store'
import { useThemeStore } from '../../store/theme.store'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', perm: null },
  { to: '/leads', icon: Users, label: 'Leads', perm: 'view_leads' },
  { to: '/scraper', icon: Search, label: 'Scraper', perm: 'run_scraper' },
  { to: '/review', icon: ListTodo, label: 'Review', perm: 'view_leads' },
  { to: '/outreach', icon: Send, label: 'Outreach', perm: 'send_outreach' },
  { to: '/pipeline', icon: Workflow, label: 'Pipeline', perm: 'manage_settings' },
  { to: '/pipelines', icon: GitBranch, label: 'Pipelines', perm: null },
  { to: '/tutorial', icon: BookOpen, label: 'Tutorial', perm: null },
  { to: '/settings', icon: Settings, label: 'Settings', perm: null }
]

import { useAuthStore } from '../../store/auth.store'

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const { theme, setTheme } = useThemeStore()
  const { role, permissions } = useAuthStore()
  const location = useLocation()
  
  const filteredNav = NAV_ITEMS.filter(item => {
    if (!item.perm) return true
    if (role === 'admin') return true
    return permissions.includes(item.perm)
  })

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
          <span className="text-sm font-semibold text-zinc-100 tracking-tight">LeadHunter</span>
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
