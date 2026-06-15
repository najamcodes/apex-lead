// src/components/ui/Card.tsx
interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`glass-panel rounded-xl p-5 shadow-lg shadow-black/20 transition-all duration-300 ${className}`}>
      {children}
    </div>
  )
}
