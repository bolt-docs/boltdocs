import { cn } from '../../utils/cn'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-tight',
  {
    variants: {
      variant: {
        default: 'bg-surface text-muted border-subtle',
        primary: 'bg-primary-500/15 text-primary-400 border-primary-500/20',
        success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
        warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
        danger: 'bg-red-500/15 text-red-400 border-red-500/20',
        info: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  children: React.ReactNode
}

export function Badge({
  variant = 'default',
  children,
  className = '',
  ...rest
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...rest}>
      {children}
    </span>
  )
}
