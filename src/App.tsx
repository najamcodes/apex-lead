// src/App.tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { Dashboard } from './screens/Dashboard'
import { Leads } from './screens/Leads'
import { Scraper } from './screens/Scraper'
import { Settings } from './screens/Settings'
import { Review } from './screens/Review'
import { Outreach } from './screens/Outreach'
import { Pipeline } from './screens/Pipeline'
import { useEffect } from 'react'
import { useThemeStore } from './store/theme.store'
import { useNavigate } from 'react-router-dom'

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

  useEffect(() => {
    initTheme()
  }, [])

  return (
    <HashRouter>
      <KeyboardShortcuts />
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="/scraper" element={<Scraper />} />
          <Route path="/review" element={<Review />} />
          <Route path="/outreach" element={<Outreach />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
