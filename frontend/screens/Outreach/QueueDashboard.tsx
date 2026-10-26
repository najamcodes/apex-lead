import { useEffect, useState } from 'react'
import { Calendar, Clock, AlertCircle, Play, Pause } from 'lucide-react'
import { useSettingsStore } from '../../store/settings.store'
import { format, isPast, isToday, isTomorrow } from 'date-fns'
import { api } from '../../services/api'

export function QueueDashboard() {
  const { settings, save } = useSettingsStore()
  const [queue, setQueue] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadQueue = async () => {
    setLoading(true)
    try {
      const data = await api.outreach.getPendingQueue()
      setQueue(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQueue()
  }, [])

  const toggleAutoSend = async () => {
    if (!settings) return
    await save({ auto_send_enabled: !settings.auto_send_enabled })
  }

  const formatDueTime = (isoString: string) => {
    const date = new Date(isoString)
    if (isPast(date)) return 'Overdue'
    if (isToday(date)) return `Today at ${format(date, 'h:mm a')}`
    if (isTomorrow(date)) return `Tomorrow at ${format(date, 'h:mm a')}`
    return format(date, 'MMM d, yyyy h:mm a')
  }

  if (!settings) return null

  return (
    <div className="space-y-6">
      {/* Global Control Panel */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            Automation Control Center
          </h3>
          <p className="text-sm text-zinc-400 mt-1">
            {settings.auto_send_enabled 
              ? `Background engine is active. Checking queue based on cron: ${settings.auto_send_cron}` 
              : 'Background engine is PAUSED. No emails will be sent.'}
          </p>
        </div>
        
        <button
          onClick={toggleAutoSend}
          className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors duration-300 focus:outline-none ${
            settings.auto_send_enabled ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        >
          <span className="sr-only">Toggle Auto Send</span>
          <span
            className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-lg transition-transform duration-300 flex items-center justify-center ${
              settings.auto_send_enabled ? 'translate-x-11' : 'translate-x-1'
            }`}
          >
            {settings.auto_send_enabled ? (
              <Play className="w-4 h-4 text-emerald-500 fill-current ml-0.5" />
            ) : (
              <Pause className="w-4 h-4 text-red-500 fill-current" />
            )}
          </span>
        </button>
      </div>

      {/* Queue List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
          <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            Pending Emails ({queue.length})
          </h3>
          <button 
            onClick={loadQueue}
            disabled={loading}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <span className="text-sm text-zinc-500 animate-pulse">Loading queue...</span>
          </div>
        ) : queue.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <Calendar className="w-10 h-10 text-zinc-700 mb-3" />
            <h4 className="text-zinc-300 font-medium">Inbox Zero</h4>
            <p className="text-zinc-500 text-sm mt-1 max-w-sm">
              There are no emails currently scheduled to be sent. Start a sequence to populate the queue.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-900 border-b border-zinc-800">
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Due</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Recipient</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Step</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Subject</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {queue.map((item) => {
                const isLate = isPast(new Date(item.scheduled_at))
                return (
                  <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className={`flex items-center gap-1.5 text-sm font-medium ${isLate ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {isLate && <AlertCircle className="w-3.5 h-3.5" />}
                        {formatDueTime(item.scheduled_at)}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-zinc-200">{item.business_name}</div>
                      <div className="text-xs text-zinc-500">{item.email}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-zinc-400">
                      Step {item.step}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm text-zinc-300 truncate max-w-xs" title={item.subject}>
                        {item.subject}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
