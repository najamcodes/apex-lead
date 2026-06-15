import { useState, useEffect } from 'react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Trash2, UserPlus } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'

const AVAILABLE_PERMISSIONS = [
  { id: 'view_leads', label: 'View Leads & Dashboard' },
  { id: 'run_scraper', label: 'Run Scraper' },
  { id: 'send_outreach', label: 'Send Outreach' },
  { id: 'manage_settings', label: 'Manage Settings & Pipeline' }
]

export function TeamManager() {
  const [users, setUsers] = useState<any[]>([])
  const { role, userId: currentUserId } = useAuthStore()

  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const loadUsers = async () => {
    try {
      const res = await window.api.users.list()
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

  if (role !== 'admin') {
    return (
      <Card className="p-6">
        <p className="text-zinc-400">You do not have permission to manage the team.</p>
      </Card>
    )
  }

  const handleAddUser = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault()
    if (!newEmail || !newPassword) return

    const res = await window.api.users.add({ email: newEmail, password: newPassword })
    if (res.success) {
      setNewEmail('')
      setNewPassword('')
      loadUsers()
    } else {
      alert(res.error || 'Failed to add user')
    }
  }

  const handleTogglePermission = async (user: any, permId: string) => {
    if (user.role === 'admin') return

    let currentPerms: string[] = []
    try { currentPerms = JSON.parse(user.permissions) } catch (e) {}

    const newPerms = currentPerms.includes(permId)
      ? currentPerms.filter((p: string) => p !== permId)
      : [...currentPerms, permId]

    const res = await window.api.users.updatePermissions(user.id, newPerms)
    if (res.success) {
      loadUsers()
    }
  }

  const handleDeleteUser = async (id: number) => {
    if (id === currentUserId) return
    if (!confirm('Are you sure you want to delete this user?')) return
    
    const res = await window.api.users.delete(id)
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
      </div>

      <div className="space-y-4">
        {users.map(u => {
          let perms: string[] = []
          try { perms = JSON.parse(u.permissions) } catch (e) {}

          return (
            <div key={u.id} className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-zinc-200">
                    {u.email}
                    {u.role === 'admin' && (
                      <span className="ml-2 px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400">Admin</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500">Joined {new Date(u.created_at).toLocaleDateString()}</div>
                </div>
                {u.role !== 'admin' && (
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(u.id)} className="text-red-400 hover:text-red-300 hover:bg-red-950">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {u.role !== 'admin' && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
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
              )}
            </div>
          )
        })}
      </div>

      <div className="pt-4 border-t border-zinc-800 flex gap-3">
        <input 
          type="email" 
          placeholder="New user email" 
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 text-sm focus:outline-none focus:border-emerald-500"
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddUser()}
        />
        <input 
          type="password" 
          placeholder="Password" 
          className="w-32 bg-zinc-900 border border-zinc-800 rounded-md px-3 text-sm focus:outline-none focus:border-emerald-500"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddUser()}
        />
        <Button type="button" disabled={!newEmail || !newPassword} onClick={handleAddUser}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>
    </Card>
  )
}
