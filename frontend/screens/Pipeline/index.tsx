// src/screens/Pipeline/index.tsx
import { useEffect, useState, useRef } from 'react'
import { Play, Plus, Mail, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { TargetCard } from './TargetCard'
import { TargetModal } from './TargetModal'
import { DigestHistory } from './DigestHistory'
import { QueryProfileCard } from './QueryProfileCard'
import { QueryProfileModal } from './QueryProfileModal'
import type { ScrapeTarget, QueryProfile } from '../../../shared/types/pipeline.types'
import { api } from '../../services/api'

export function Pipeline() {
  const [targets, setTargets]       = useState<ScrapeTarget[]>([])
  const [profiles, setProfiles]     = useState<QueryProfile[]>([])
  const [digests, setDigests]       = useState<any[]>([])
  const [status, setStatus]         = useState<any>(null)
  const [running, setRunning]       = useState(false)
  const [showTargetModal, setShowTargetModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [logs, setLogs]             = useState<string[]>([])
  const [activeTab, setActiveTab]   = useState<'targets' | 'profiles' | 'history'>('targets')
  const logsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    load()
    const cleanup = api.pipeline.onLog((msg: string) => {
      setLogs((prev) => [...prev.slice(-99), msg])
    })
    return cleanup
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [logs])

  const load = async () => {
    const [t, p, d, s] = await Promise.all([
      api.pipeline.getTargets(),
      api.queryProfiles.getAll(),
      api.pipeline.getDigests(),
      api.pipeline.getStatus(),
    ])
    setTargets(t)
    setProfiles(p)
    setDigests(d)
    setStatus(s)
  }

  const handleRunNow = async () => {
    setRunning(true)
    setLogs([])
    try {
      const result = await api.pipeline.runNow()
      toast.success(`Pipeline complete — ${result.total_new} new leads, digest sent`)
      await load()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setRunning(false)
    }
  }

  const handleSendDigest = async () => {
    await api.pipeline.sendDigestNow()
    toast.success('Digest email sent')
  }

  const activeTargets = targets.filter((t) => t.status === 'active').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Pipeline</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {activeTargets} active target{activeTargets !== 1 ? 's' : ''} —
            runs automatically every night
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleSendDigest}>
            <Mail className="w-3.5 h-3.5" />
            Send digest now
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowTargetModal(true)}>
            <Plus className="w-3.5 h-3.5" />
            Add target
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowProfileModal(true)}>
            <Plus className="w-3.5 h-3.5" />
            Add Profile
          </Button>
          <Button variant="primary" size="sm" loading={running} onClick={handleRunNow}>
            <Play className="w-3.5 h-3.5" />
            Run now
          </Button>
        </div>
      </div>

      {/* Status bar */}
      {status?.runner && (
        <div className="flex items-center gap-4 bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/80 rounded-xl px-5 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status.runner.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
            <span className="text-sm text-zinc-300">
              {status.runner.enabled ? 'Autonomous mode active' : 'Manual mode only'}
            </span>
          </div>
          {status.runner.enabled && (
            <>
              <div className="text-xs text-zinc-500">
                <Clock className="w-3 h-3 inline mr-1" />
                Scrape: <span className="text-zinc-400 font-mono">{status.runner.scrape_cron}</span>
              </div>
              <div className="text-xs text-zinc-500">
                <Mail className="w-3 h-3 inline mr-1" />
                Digest: <span className="text-zinc-400 font-mono">{status.runner.digest_cron}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/80 p-1 rounded-lg w-max shadow-sm">
        <button
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
            activeTab === 'targets' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          }`}
          onClick={() => setActiveTab('targets')}
        >
          Targets ({targets.length})
        </button>
        <button
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
            activeTab === 'profiles' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          }`}
          onClick={() => setActiveTab('profiles')}
        >
          AI Profiles ({profiles.length})
        </button>
        <button
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
            activeTab === 'history' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          }`}
          onClick={() => setActiveTab('history')}
        >
          History ({digests.length})
        </button>
      </div>

      {/* Targets tab */}
      {activeTab === 'targets' && (
        <div className="space-y-3">
          {targets.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-sm text-zinc-400 mb-2">No targets configured yet</p>
              <p className="text-xs text-zinc-600 mb-4">
                Add a target to start running the autonomous pipeline.
              </p>
              <Button variant="primary" size="sm" onClick={() => setShowTargetModal(true)}>
                <Plus className="w-3.5 h-3.5" /> Add first target
              </Button>
            </Card>
          ) : (
            targets.map((target) => (
              <TargetCard
                key={target.id}
                target={target}
                onToggle={async () => {
                  await api.pipeline.toggleTarget(target.id)
                  await load()
                }}
                onDelete={async () => {
                  await api.pipeline.deleteTarget(target.id)
                  toast.success('Target removed')
                  await load()
                }}
              />
            ))
          )}
        </div>
      )}

      {/* Profiles tab */}
      {activeTab === 'profiles' && (
        <div className="space-y-3">
          {profiles.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-sm text-zinc-400 mb-2">No AI profiles configured</p>
              <p className="text-xs text-zinc-600 mb-4">
                Create a Smart Query Profile to let AI automatically generate dynamic targets.
              </p>
              <Button variant="primary" size="sm" onClick={() => setShowProfileModal(true)}>
                <Plus className="w-3.5 h-3.5" /> Add Profile
              </Button>
            </Card>
          ) : (
            profiles.map((profile) => (
              <QueryProfileCard
                key={profile.id}
                profile={profile}
                onToggleStatus={async () => {
                  await api.queryProfiles.updateStatus(profile.id, profile.status === 'active' ? 'paused' : 'active')
                  await load()
                }}
                onDelete={async () => {
                  await api.queryProfiles.delete(profile.id)
                  toast.success('Profile removed')
                  await load()
                }}
              />
            ))
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && <DigestHistory digests={digests} />}

      {/* Live log */}
      {running && logs.length > 0 && (
        <div className="bg-zinc-950/80 backdrop-blur-sm border border-zinc-800/80 rounded-xl p-4 shadow-inner">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Live log</p>
          <div
            ref={logsRef}
            className="h-40 overflow-y-auto space-y-1 font-mono text-[11px] leading-relaxed"
          >
            {logs.map((log, i) => (
              <div key={i} className="text-zinc-400">{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* Add target modal */}
      {showTargetModal && (
        <TargetModal
          onClose={() => setShowTargetModal(false)}
          onSave={async (data) => {
            await api.pipeline.addTarget(data)
            toast.success(`Target "${data.label}" added`)
            setShowTargetModal(false)
            await load()
          }}
        />
      )}

      {/* Add profile modal */}
      {showProfileModal && (
        <QueryProfileModal
          onClose={() => setShowProfileModal(false)}
          onSave={async (data) => {
            await api.queryProfiles.insert(data)
            toast.success(`Profile "${data.label}" added`)
            setShowProfileModal(false)
            await load()
          }}
        />
      )}
    </div>
  )
}
