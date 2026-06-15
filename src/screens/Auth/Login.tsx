import { useState } from 'react'
import { useAuthStore } from '../../store/auth.store'

export function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long')
        setIsLoading(false)
        return
      }

      if (isLogin) {
        // We will implement an IPC call for auth:login
        const result = await window.api.auth.login({ email, password })
        if (result.success) {
          login(result.user.id, result.user.org_id, result.user.email, result.user.role, result.user.permissions)
        } else {
          setError(result.error || 'Invalid credentials')
        }
      } else {
        const result = await window.api.auth.register({ email, password })
        if (result.success) {
          login(result.user.id, result.user.org_id, result.user.email, result.user.role, result.user.permissions)
        } else {
          setError(result.error || 'Registration failed')
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">LeadGen Desk SaaS</h1>
          <p className="text-zinc-400 text-sm">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-900/50 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              required
              autoFocus
              autoComplete="email"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              required
              autoComplete={isLogin ? "current-password" : "new-password"}
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isLoading ? 'Authenticating...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {isLogin ? "Don't have an account? Register" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
