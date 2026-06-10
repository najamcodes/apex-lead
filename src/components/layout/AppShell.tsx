// src/components/layout/AppShell.tsx
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ErrorBoundary } from '../ui/ErrorBoundary'

export function AppShell() {
  return (
    <div className="flex h-screen w-screen bg-zinc-900 text-zinc-100 overflow-hidden select-none">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 bg-[#0c0c0e]">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
