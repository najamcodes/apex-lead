import { useEffect, useState } from 'react'
import { PauseCircle } from 'lucide-react'

export function SchedulerStatusWidget() {
  const [isActive, setIsActive] = useState<boolean | null>(null)

  useEffect(() => {
    const checkStatus = async () => {
      const status = await window.api.scheduler.status()
      setIsActive(status)
    }
    checkStatus()
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  if (isActive === null) return null

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
      {isActive ? (
        <>
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="text-xs font-medium text-emerald-400">Auto-Sender Active</span>
        </>
      ) : (
        <>
          <PauseCircle className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs font-medium text-zinc-500">Auto-Sender Paused</span>
        </>
      )}
    </div>
  )
}
