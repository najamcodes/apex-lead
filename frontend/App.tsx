// src/App.tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { Dashboard } from './screens/Dashboard'
import { Leads } from './screens/Leads'
import { Scraper } from './screens/Scraper'
import { Settings } from './screens/Settings'
import { Review } from './screens/Review'
import { Login } from './screens/Auth/Login'
import { useAuthStore, canManageOrg, roleLevel } from './store/auth.store'
import { Outreach } from './screens/Outreach'
import { Tutorial } from './screens/Tutorial'
import { Pipelines } from './screens/Pipelines'
import WorkersScreen from './screens/Workers'
import DataStudio from './screens/DataStudio'
import AnalyticsDashboard from './screens/Analytics'
import ApprovalsScreen from './screens/Approvals'
import { OrgManager } from './screens/Settings/OrgManager'
import { useEffect, useState } from 'react'
import { useThemeStore } from './store/theme.store'
import { useNavigate } from 'react-router-dom'
import { api } from './services/api'

function ProtectedRoute({ children, perm }: { children: React.ReactNode, perm: string | null }) {
  const { role, permissions } = useAuthStore()
  // org_admin and above bypass all permission checks
  if (canManageOrg(role ?? 'user')) return <>{children}</>
  if (!perm) return <>{children}</>
  if (permissions.includes(perm)) return <>{children}</>

  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 font-sans">
      <h2 className="text-2xl font-bold text-red-500">Access Denied</h2>
      <p className="text-zinc-400">You do not have permission to view this page.</p>
    </div>
  )
}

/** Route guard for minimum role level (e.g. super_admin only pages) */
function MinRoleRoute({ children, minRole }: { children: React.ReactNode, minRole: string }) {
  const { role } = useAuthStore()
  if (roleLevel(role ?? 'user') >= roleLevel(minRole)) return <>{children}</>
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 font-sans">
      <h2 className="text-2xl font-bold text-red-500">Access Denied</h2>
      <p className="text-zinc-400">This area requires {minRole} access or higher.</p>
    </div>
  )
}

function KeyboardShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing in inputs
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      )
        return

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
            navigate('/dashboard')
            break
          case '2':
            navigate('/leads')
            break
          case '3':
            navigate('/scraper')
            break
          case '4':
            navigate('/review')
            break
          case '5':
            navigate('/outreach')
            break
          case ',':
            navigate('/settings')
            break
        }
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [navigate])

  return null
}

export default function App() {
  const { initTheme } = useThemeStore()
  const { isAuthenticated } = useAuthStore()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    initTheme()

    // Restore session in main process if authenticated
    const state = useAuthStore.getState()
    if (state.isAuthenticated && state.userId) {
      api.auth.restoreSession({ userId: state.userId })
        .then(() => setIsReady(true))
        .catch((err) => {
          console.error(err)
          setIsReady(true)
        })
    } else {
      setIsReady(true)
    }
  }, [])

  if (!isReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-white font-sans">
        <div className="animate-pulse">Loading workspace...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login />
  }

  return (
    <HashRouter>
      <KeyboardShortcuts />
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<ProtectedRoute perm={null}><Dashboard /></ProtectedRoute>} />
          <Route path="leads" element={<ProtectedRoute perm="view_leads"><Leads /></ProtectedRoute>} />
          <Route path="/scraper" element={<ProtectedRoute perm="run_scraper"><Scraper /></ProtectedRoute>} />
          <Route path="/review" element={<ProtectedRoute perm="view_leads"><Review /></ProtectedRoute>} />
          <Route path="/outreach" element={<ProtectedRoute perm="send_outreach"><Outreach /></ProtectedRoute>} />
          <Route path="/pipeline" element={<Navigate to="/pipelines" replace />} />
          <Route path="/pipelines" element={<ProtectedRoute perm={null}><Pipelines /></ProtectedRoute>} />
          <Route path="/approvals" element={<ProtectedRoute perm={null}><ApprovalsScreen /></ProtectedRoute>} />
          <Route path="/data-studio" element={<ProtectedRoute perm={null}><DataStudio /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute perm={null}><AnalyticsDashboard /></ProtectedRoute>} />
          <Route path="/workers" element={<ProtectedRoute perm={null}><WorkersScreen /></ProtectedRoute>} />
          <Route path="/tutorial" element={<ProtectedRoute perm={null}><Tutorial /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute perm={null}><Settings /></ProtectedRoute>} />
          <Route path="/orgs" element={<MinRoleRoute minRole="org_admin"><OrgManager /></MinRoleRoute>} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
