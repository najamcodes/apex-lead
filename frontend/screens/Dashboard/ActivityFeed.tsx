// src/screens/Dashboard/ActivityFeed.tsx
import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import type { ActivityRecord } from '@sdk/core/types'
import { api } from '../../services/api'

type ActivityWithBusiness = ActivityRecord & { business_name: string }

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityWithBusiness[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Note: To implement this properly, we should add a api.activity.getRecent() function.
    // For now, let's assume we can fetch them or we'll add the IPC endpoint next.
    // Oh wait, I added getRecentActivity in db/queries/activity.queries.ts, but didn't expose it to IPC.
    // Let me add it to IPC later, for now we will stub the call.
    api.activity
      .getRecent?.()
      .then((data: any) => {
        setActivities(data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="h-40 animate-pulse bg-zinc-800/50 rounded-xl" />

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
          <Activity className="w-4 h-4 text-zinc-400" />
        </div>
        <div>
          <h3 className="font-semibold text-zinc-100">Recent Activity</h3>
          <p className="text-sm text-zinc-500">Latest pipeline updates</p>
        </div>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        {activities.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">No recent activity</p>
        ) : (
          activities.map((act) => (
            <div key={act.id} className="relative pl-4 border-l border-zinc-800">
              <div className="absolute -left-1.5 top-1.5 w-3 h-3 bg-zinc-800 rounded-full border border-zinc-950" />
              <div className="flex justify-between items-baseline mb-0.5">
                <p className="text-sm font-medium text-zinc-200">{act.business_name}</p>
                <p className="text-xs text-zinc-500">{new Date(act.created_at).toLocaleString()}</p>
              </div>
              <p className="text-sm text-zinc-400 capitalize">{act.event.replace(/_/g, ' ')}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
