// src/components/ui/Input.tsx
import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-zinc-400">{label}</label>}
      <input
        ref={ref}
        className={`
          w-full px-3 py-2 rounded-md text-sm bg-zinc-800 border
          text-zinc-100 placeholder-zinc-500 outline-none
          border-zinc-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30
          transition-colors duration-150
          ${error ? 'border-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'
