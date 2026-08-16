import { useState, useEffect } from 'react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Building2, Plus, Users, Trash2, UserPlus, Crown, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'

interface OrgMember {
  user_id: number
  org_id: number
  role: string
  permissions: string
  created_at: string
  user: {
    id: number
    email: string
    name: string | null
  }
}

interface Org {
  id: number
  name: string
  tier: string
  max_users: number
  created_at: string
}

const TIER_COLORS: Record<string, string> = {
  free: 'bg-zinc-700/50 text-zinc-400',
  starter: 'bg-blue-500/20 text-blue-400',
  pro: 'bg-purple-500/20 text-purple-400',
  enterprise: 'bg-amber-500/20 text-amber-400',
}

const ROLE_COLORS: Record<string, string> = {
  org_admin: 'bg-emerald-500/20 text-emerald-400',
  manager: 'bg-blue-500/20 text-blue-400',
  user: 'bg-zinc-700/50 text-zinc-300',
  viewer: 'bg-zinc-800/50 text-zinc-500',
}

export function OrgManager() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgTier, setNewOrgTier] = useState<string>('free')
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [memberUserId, setMemberUserId] = useState('')
  const [memberRole, setMemberRole] = useState('user')
  const [loading, setLoading] = useState(false)

  const { role } = useAuthStore()
  const isSuperAdmin = role === 'super_admin'

  const loadOrgs = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/orgs', { credentials: 'include' })
      const data = await res.json()
      if (data.success) setOrgs(data.organizations ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadMembers = async (orgId: number) => {
    try {
      const res = await fetch(`/api/orgs/${orgId}/members`, { credentials: 'include' })
      const data = await res.json()
      if (data.success) setMembers(data.members ?? [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadOrgs()
  }, [])

  useEffect(() => {
    if (selectedOrg) {
      loadMembers(selectedOrg.id)
    }
  }, [selectedOrg])

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return
    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOrgName, tier: newOrgTier }),
      })
      const data = await res.json()
      if (data.success) {
        setNewOrgName('')
        setIsCreating(false)
        await loadOrgs()
      } else {
        alert(data.error ?? 'Failed to create organization')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteOrg = async (orgId: number) => {
    if (!confirm('Delete this organization? This will remove all associated data.')) return
    try {
      const res = await fetch(`/api/orgs/${orgId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        if (selectedOrg?.id === orgId) setSelectedOrg(null)
        await loadOrgs()
      } else {
        alert(data.error ?? 'Failed to delete organization')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddMember = async () => {
    if (!selectedOrg || !memberUserId) return
    try {
      const res = await fetch(`/api/orgs/${selectedOrg.id}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: Number(memberUserId), role: memberRole }),
      })
      const data = await res.json()
      if (data.success) {
        setMemberUserId('')
        setMemberRole('user')
        setIsAddingMember(false)
        await loadMembers(selectedOrg.id)
      } else {
        alert(data.error ?? 'Failed to add member')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleRemoveMember = async (userId: number) => {
    if (!selectedOrg) return
    if (!confirm('Remove this member from the organization?')) return
    try {
      const res = await fetch(`/api/orgs/${selectedOrg.id}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        await loadMembers(selectedOrg.id)
      } else {
        alert(data.error ?? 'Failed to remove member')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleUpdateMemberRole = async (userId: number, newRole: string) => {
    if (!selectedOrg) return
    try {
      const res = await fetch(`/api/orgs/${selectedOrg.id}/members/${userId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (data.success) await loadMembers(selectedOrg.id)
      else alert(data.error ?? 'Failed to update role')
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizations</h1>
          <p className="text-sm text-zinc-400 mt-1">Manage all organizations and their members.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadOrgs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {isSuperAdmin && (
            <Button size="sm" onClick={() => setIsCreating(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Organization
            </Button>
          )}
        </div>
      </div>

      {/* Create Org Form */}
      {isCreating && (
        <Card className="p-4 border border-emerald-500/30 bg-emerald-500/5">
          <h3 className="text-sm font-medium text-zinc-200 mb-3">Create New Organization</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Organization name"
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
              value={newOrgName}
              onChange={e => setNewOrgName(e.target.value)}
              autoFocus
            />
            <select
              value={newOrgTier}
              onChange={e => setNewOrgTier(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <Button onClick={handleCreateOrg} disabled={!newOrgName.trim()}>Create</Button>
            <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Org List */}
        <div className="lg:col-span-1 space-y-2">
          {orgs.length === 0 && !loading && (
            <Card className="p-4 text-center text-zinc-500 text-sm">No organizations found</Card>
          )}
          {orgs.map(org => (
            <button
              key={org.id}
              onClick={() => setSelectedOrg(org)}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                selectedOrg?.id === org.id
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-zinc-200">{org.name}</div>
                    <div className="text-xs text-zinc-500">ID #{org.id}</div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs ${TIER_COLORS[org.tier] ?? 'bg-zinc-700 text-zinc-400'}`}>
                  {org.tier}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> max {org.max_users}
                </span>
                <span>{new Date(org.created_at).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Members Panel */}
        <div className="lg:col-span-2">
          {!selectedOrg ? (
            <Card className="p-8 flex flex-col items-center justify-center text-center">
              <Building2 className="w-10 h-10 text-zinc-700 mb-3" />
              <p className="text-zinc-500 text-sm">Select an organization to manage its members</p>
            </Card>
          ) : (
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-zinc-200">{selectedOrg.name}</h3>
                  <p className="text-xs text-zinc-500">{members.length} member{members.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setIsAddingMember(v => !v)}>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Add Member
                  </Button>
                  {isSuperAdmin && (
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-950"
                      onClick={() => handleDeleteOrg(selectedOrg.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Add Member Form */}
              {isAddingMember && (
                <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50 space-y-2">
                  <div className="text-xs font-medium text-zinc-400">Add member by User ID</div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="User ID"
                      className="w-24 bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                      value={memberUserId}
                      onChange={e => setMemberUserId(e.target.value)}
                    />
                    <select
                      value={memberRole}
                      onChange={e => setMemberRole(e.target.value)}
                      className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                      <option value="org_admin">Org Admin</option>
                    </select>
                    <Button size="sm" onClick={handleAddMember} disabled={!memberUserId}>Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsAddingMember(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Member List */}
              <div className="space-y-2">
                {members.length === 0 && (
                  <p className="text-sm text-zinc-500 text-center py-4">No members yet</p>
                )}
                {members.map(m => (
                  <div key={m.user_id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                      {(m.user?.name ?? m.user?.email)?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-zinc-200 truncate">{m.user?.name ?? m.user?.email}</div>
                      {m.user?.name && <div className="text-xs text-zinc-500 truncate">{m.user?.email}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      {m.role === 'org_admin' ? (
                        <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${ROLE_COLORS.org_admin}`}>
                          <Crown className="w-2.5 h-2.5" /> org_admin
                        </span>
                      ) : (
                        <select
                          value={m.role}
                          onChange={e => handleUpdateMemberRole(m.user_id, e.target.value)}
                          className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-0.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="viewer">viewer</option>
                          <option value="user">user</option>
                          <option value="manager">manager</option>
                          <option value="org_admin">org_admin</option>
                        </select>
                      )}
                      {m.role !== 'org_admin' && (
                        <button
                          onClick={() => handleRemoveMember(m.user_id)}
                          className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
