// src/components/ui/Button.tsx
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const VARIANTS = {
  primary: 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white border-transparent shadow-sm shadow-emerald-500/20',
  secondary: 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border-zinc-700/50 backdrop-blur-sm',
  ghost: 'bg-transparent hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 border-transparent',
  danger: 'bg-red-900/40 hover:bg-red-900/60 text-red-400 border-red-800/50 backdrop-blur-sm'
}
const SIZES = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'secondary', size = 'md', loading, children, disabled, className = '', ...props },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        inline-flex items-center gap-2 rounded-md border font-medium justify-center
        transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
        active:scale-[0.98]
        ${VARIANTS[variant]} ${SIZES[size]} ${className}
      `}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  )
)
Button.displayName = 'Button'
