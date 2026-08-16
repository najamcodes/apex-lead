import { useState, useEffect } from 'react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Trash2, UserPlus, ShieldCheck } from 'lucide-react'
import { useAuthStore, canManageOrg, roleLevel } from '../../store/auth.store'
import { api } from '../../services/api'

const AVAILABLE_PERMISSIONS = [
  { id: 'view_leads', label: 'View Leads & Data Studio' },
  { id: 'run_scraper', label: 'Run Scrapers' },
  { id: 'send_outreach', label: 'Send Outreach & Campaigns' },
  { id: 'view_pipelines', label: 'View Pipelines & Run History' },
  { id: 'run_pipelines', label: 'Run & Replay Pipelines' },
  { id: 'edit_pipelines', label: 'Create, Edit & Delete Pipelines' },
  { id: 'manage_plugins', label: 'Manage Custom Nodes & Plugins' },
  { id: 'approve_runs', label: 'Approve & Reject Checkpoints' },
  { id: 'manage_settings', label: 'Manage Settings & API Keys' },
]

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer — read-only access' },
  { value: 'user', label: 'User — can scrape leads' },
  { value: 'manager', label: 'Manager — sees all org data' },
]

const ROLE_BADGE_COLORS: Record<string, string> = {
  org_admin: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  manager: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  user: 'bg-zinc-700/50 text-zinc-300 border border-zinc-600/50',
  viewer: 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50',
}

export function TeamManager() {
  const [users, setUsers] = useState<any[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'viewer' | 'user' | 'manager'>('user')
  const [newName, setNewName] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const { role, userId: currentUserId } = useAuthStore()

  const loadUsers = async () => {
    try {
      const res = await api.users.list()
      if (res.success) {
        setUsers(res.users)
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // Use proper role check — org_admin and above can manage team
  if (!canManageOrg(role ?? 'user')) {
    return (
      <Card className="p-6">
        <p className="text-zinc-400">You do not have permission to manage the team.</p>
      </Card>
    )
  }

  const handleAddUser = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault()
    if (!newEmail || !newPassword) return

    setIsAdding(true)
    try {
      const res = await api.users.add({ email: newEmail, password: newPassword, role: newRole, name: newName || undefined })
      if (res.success) {
        setNewEmail('')
        setNewPassword('')
        setNewName('')
        setNewRole('user')
        loadUsers()
      } else {
        alert(res.error || 'Failed to add user')
      }
    } finally {
      setIsAdding(false)
    }
  }

  const handleChangeRole = async (user: any, newUserRole: string) => {
    if (user.org_role === 'org_admin') return
    // Cannot assign role equal to or higher than own
    if (roleLevel(newUserRole) >= roleLevel(role ?? 'user')) {
      alert('Cannot assign a role equal to or higher than your own')
      return
    }
    const res = await api.users.updateRole(user.id, newUserRole)
    if (res.success) loadUsers()
  }

  const handleTogglePermission = async (user: any, permId: string) => {
    if (user.org_role === 'org_admin') return

    let currentPerms: string[] = []
    try { currentPerms = user.org_permissions ?? JSON.parse(user.permissions || '[]') } catch (e) {}

    const newPerms = currentPerms.includes(permId)
      ? currentPerms.filter((p: string) => p !== permId)
      : [...currentPerms, permId]

    const res = await api.users.updatePermissions(user.id, newPerms)
    if (res.success) {
      loadUsers()
    }
  }

  const handleDeleteUser = async (id: number) => {
    if (id === currentUserId) return
    if (!confirm('Are you sure you want to remove this user?')) return
    
    const res = await api.users.delete(id)
    if (res.success) {
      loadUsers()
    }
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">Team Management</h3>
          <p className="text-sm text-zinc-400">Manage users and roles in your organization.</p>
        </div>
        <ShieldCheck className="w-5 h-5 text-emerald-500" />
      </div>

      <div className="space-y-4">
        {users.map(u => {
          const orgRole = u.org_role ?? u.role
          let perms: string[] = []
          try { perms = u.org_permissions ?? JSON.parse(u.permissions || '[]') } catch (e) {}
          const isCurrentUser = u.id === currentUserId
          const isAdmin = orgRole === 'org_admin'

          return (
            <div key={u.id} className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/30 to-blue-500/30 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-200">
                    {(u.name ?? u.email)?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-zinc-200 flex items-center gap-2">
                      {u.name ?? u.email}
                      {isCurrentUser && <span className="text-xs text-zinc-500">(you)</span>}
                      <span className={`ml-1 px-2 py-0.5 rounded text-xs ${ROLE_BADGE_COLORS[orgRole] ?? 'bg-zinc-700 text-zinc-400'}`}>
                        {orgRole}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500">{u.name ? u.email : ''} · Joined {new Date(u.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                {!isAdmin && !isCurrentUser && (
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(u.id)} className="text-red-400 hover:text-red-300 hover:bg-red-950">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {!isAdmin && (
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  {/* Role selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-16">Role:</span>
                    <select
                      value={orgRole}
                      onChange={e => handleChangeRole(u, e.target.value)}
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      {ROLE_OPTIONS.map(r => (
                        <option key={r.value} value={r.value}
                          disabled={roleLevel(r.value) >= roleLevel(role ?? 'user')}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Permissions */}
                  <div>
                    <div className="text-xs text-zinc-500 mb-2">Permissions:</div>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_PERMISSIONS.map(p => {
                        const hasPerm = perms.includes(p.id)
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleTogglePermission(u, p.id)}
                            className={`px-3 py-1.5 text-xs font-medium border rounded-md transition-colors ${
                              hasPerm 
                                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                                : 'bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {p.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="pt-4 border-t border-zinc-800 space-y-3">
        <h4 className="text-sm font-medium text-zinc-300">Add Team Member</h4>
        <div className="grid grid-cols-2 gap-2">
          <input 
            type="text" 
            placeholder="Full name (optional)" 
            className="col-span-2 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-zinc-200"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <input 
            type="email" 
            placeholder="Email address" 
            className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-zinc-200"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
          />
          <input 
            type="password" 
            placeholder="Password (min 8 chars)" 
            className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-zinc-200"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-zinc-200"
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <Button
            type="button"
            disabled={!newEmail || !newPassword || isAdding}
            onClick={handleAddUser}
            className="col-start-2"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            {isAdding ? 'Adding…' : 'Add Member'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
