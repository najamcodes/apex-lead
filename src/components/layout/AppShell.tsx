// src/components/layout/AppShell.tsx
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ErrorBoundary } from '../ui/ErrorBoundary'

export function AppShell() {
  return (
    <div className="flex h-screen w-screen bg-[#09090b] text-zinc-100 overflow-hidden select-none font-sans">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 bg-[#09090b]">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 bg-[#09090b] animate-in slide-in-from-bottom-4 fade-in duration-500">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
