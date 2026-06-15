// src/components/layout/Sidebar.tsx
import { NavLink } from 'react-router-dom'
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
  Moon
} from 'lucide-react'
import { useAppStore } from '../../store/app.store'
import { useThemeStore } from '../../store/theme.store'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/scraper', icon: Search, label: 'Scraper' },
  { to: '/review', icon: ListTodo, label: 'Review' },
  { to: '/outreach', icon: Send, label: 'Outreach' },
  { to: '/pipeline', icon: Workflow, label: 'Pipeline' },
  { to: '/settings', icon: Settings, label: 'Settings' }
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const { theme, setTheme } = useThemeStore()

  return (
    <aside
      className={`
      flex flex-col bg-zinc-950/80 backdrop-blur-xl border-r border-zinc-800/50
      transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]
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
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 font-sans">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `
              flex items-center gap-2.5 px-2.5 py-2 rounded-md
              text-sm transition-all duration-200
              ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
              }
            `}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {!sidebarCollapsed && <span>{label}</span>}
          </NavLink>
        ))}
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
