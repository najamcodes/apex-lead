'use client'

import { BrowserRouter } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { wsClient } from '@/services/ws-client'

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
    const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws'
    wsClient.connect(wsUrl)
    return () => wsClient.disconnect()
  }, [mounted])

  if (!mounted) return null
  return <BrowserRouter>{children}</BrowserRouter>
}
