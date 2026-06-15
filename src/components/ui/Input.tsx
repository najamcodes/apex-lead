// src/components/ui/Input.tsx
import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-slate-400">{label}</label>}
      <input
        ref={ref}
        className={`
          w-full px-3 py-2 rounded-md text-sm bg-slate-900/40 backdrop-blur-sm border
          text-slate-100 placeholder-slate-500 outline-none
          border-white/5 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 focus:bg-slate-900/60
          transition-all duration-200 shadow-sm
          ${error ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'
