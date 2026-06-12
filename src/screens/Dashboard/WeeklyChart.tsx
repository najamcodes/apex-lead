// src/screens/Dashboard/WeeklyChart.tsx
import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import { format } from 'date-fns'

export function WeeklyChart() {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    window.api.outreach.getChartData().then((d) => setData(d.weekly))
  }, [])

  if (data.length === 0) return null

  const formatted = data.map((d) => ({
    ...d,
    date: format(new Date(d.date), 'MMM d')
  }))

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">Leads — last 14 days</h3>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={formatted} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gScraped" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3f3f46" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#3f3f46" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gApproved" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#059669" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: 8,
              fontSize: 12
            }}
            labelStyle={{ color: '#a1a1aa' }}
          />
          <Area
            type="monotone"
            dataKey="scraped"
            stroke="#52525b"
            fill="url(#gScraped)"
            strokeWidth={1.5}
            name="Scraped"
          />
          <Area
            type="monotone"
            dataKey="approved"
            stroke="#10b981"
            fill="url(#gApproved)"
            strokeWidth={1.5}
            name="Approved"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
