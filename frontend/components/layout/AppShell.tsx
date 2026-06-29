// src/components/layout/AppShell.tsx
import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ErrorBoundary } from '../ui/ErrorBoundary'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden select-none font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[30rem] h-[30rem] bg-teal-500/10 rounded-full blur-[128px] pointer-events-none" />

      <div className="z-10 flex h-full w-full">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 bg-transparent">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-6 bg-transparent animate-in slide-in-from-bottom-4 fade-in duration-500">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  )
}
