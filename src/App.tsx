// src/App.tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { Dashboard } from './screens/Dashboard'
import { Leads } from './screens/Leads'
import { Scraper } from './screens/Scraper'
import { Settings } from './screens/Settings'
import { Review } from './screens/Review'
import { Login } from './screens/Auth/Login'
import { useAuthStore } from './store/auth.store'
import { Outreach } from './screens/Outreach'
import { Pipeline } from './screens/Pipeline'
import { useEffect, useState } from 'react'
import { useThemeStore } from './store/theme.store'
import { useNavigate } from 'react-router-dom'

function ProtectedRoute({ children, perm }: { children: React.ReactNode, perm: string | null }) {
  const { role, permissions } = useAuthStore()
  if (role === 'admin') return <>{children}</>
  if (!perm) return <>{children}</>
  if (permissions.includes(perm)) return <>{children}</>

  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 font-sans">
      <h2 className="text-2xl font-bold text-red-500">Access Denied</h2>
      <p className="text-zinc-400">You do not have permission to view this page.</p>
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
      window.api.auth.restoreSession({ userId: state.userId })
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
          <Route path="/pipeline" element={<ProtectedRoute perm="manage_settings"><Pipeline /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute perm={null}><Settings /></ProtectedRoute>} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
