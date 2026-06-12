import { useEffect, useState } from 'react'
import { MapPin, Trophy } from 'lucide-react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { CityRoiStat } from '../../types'

export function CityRoiStats() {
  const [stats, setStats] = useState<CityRoiStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.stats.getCityRoi().then((data: CityRoiStat[]) => {
      setStats(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 font-sans h-[300px] flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading ROI data...</div>
      </div>
    )
  }

  if (stats.length === 0) {
    return null
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 font-sans flex flex-col h-full col-span-1 md:col-span-2">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-zinc-100">Geographic ROI Heatmap</h3>
      </div>
      
      <div className="flex-1 w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis 
              type="number" 
              dataKey="lead_count" 
              name="Leads" 
              tick={{ fill: '#71717a', fontSize: 12 }}
              stroke="#3f3f46"
              label={{ value: 'Lead Volume', position: 'insideBottom', offset: -10, fill: '#71717a', fontSize: 12 }}
            />
            <YAxis 
              type="number" 
              dataKey="avg_ai_score" 
              name="AI Score" 
              domain={[0, 100]}
              tick={{ fill: '#71717a', fontSize: 12 }}
              stroke="#3f3f46"
              label={{ value: 'Avg Quality Score', angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 12 }}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as CityRoiStat
                  return (
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-xl">
                      <p className="text-sm font-medium text-zinc-100 mb-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        {data.city}
                      </p>
                      <p className="text-xs text-zinc-400">Leads: <span className="text-zinc-200">{data.lead_count}</span></p>
                      <p className="text-xs text-zinc-400">Avg Score: <span className="text-zinc-200">{data.avg_ai_score.toFixed(1)}</span></p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Scatter name="Cities" data={stats}>
              {stats.map((entry, index) => {
                // Color nodes based on AI score (hotter = greener)
                const opacity = Math.min(1, Math.max(0.3, entry.lead_count / 100))
                const color = entry.avg_ai_score > 70 ? '#34d399' : entry.avg_ai_score > 40 ? '#fbbf24' : '#f87171'
                return <Cell key={`cell-${index}`} fill={color} fillOpacity={opacity} />
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
