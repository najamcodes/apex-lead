import { type TextareaHTMLAttributes, forwardRef } from 'react'

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-zinc-400">{label}</label>}
      <textarea
        ref={ref}
        className={`
          w-full px-3 py-2 rounded-md text-sm bg-zinc-900/60 backdrop-blur-sm border
          text-zinc-100 placeholder-zinc-500 outline-none
          border-zinc-800/80 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 focus:bg-zinc-900/80
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
TextArea.displayName = 'TextArea'
