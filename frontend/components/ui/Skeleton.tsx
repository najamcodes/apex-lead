// src/components/ui/Skeleton.tsx
import { clsx } from 'clsx'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-md bg-zinc-800/50 dark:bg-zinc-800/50 light:bg-zinc-200/50',
        className
      )}
      {...props}
    />
  )
}
