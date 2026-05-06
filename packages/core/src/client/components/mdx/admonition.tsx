import {
  Info,
  Lightbulb,
  AlertTriangle,
  ShieldAlert,
  Bookmark,
  Zap,
  Flame,
} from 'lucide-react'
import { cn } from '../../utils/cn'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

const ICON_MAP: Record<string, React.ReactNode> = {
  note: <Bookmark size={18} />,
  tip: <Lightbulb size={18} />,
  info: <Info size={18} />,
  warning: <AlertTriangle size={18} />,
  danger: <ShieldAlert size={18} />,
  important: <Flame size={18} />,
  caution: <Zap size={18} />,
}

const admonitionVariants = cva(
  'py-4 px-4 rounded-lg flex items-center gap-3 border-[1px] flex-row',
  {
    variants: {
      type: {
        note: 'border-primary-200 dark:border-primary-800 bg-primary-500/5 text-primary-400',
        tip: 'border-emerald-200 dark:border-emerald-800 bg-emerald-500/5 text-emerald-500',
        info: 'border-sky-200 dark:border-sky-800 bg-sky-500/5 text-sky-500',
        warning:
          'border-amber-200 dark:border-amber-800 bg-amber-500/5 text-amber-500',
        danger:
          'border-red-200 dark:border-red-800/70 bg-red-500/5 text-red-500',
        important:
          'border-orange-200 dark:border-orange-800/70 bg-orange-500/5 text-orange-500',
        caution:
          'border-yellow-200 dark:border-yellow-800/70 bg-yellow-500/5 text-yellow-500',
      },
    },
    defaultVariants: {
      type: 'note',
    },
  },
)
type AdmonitionVariants = VariantProps<typeof admonitionVariants>

export interface AdmonitionProps
  extends React.HTMLAttributes<HTMLDivElement>,
    AdmonitionVariants {
  title?: string
  children: React.ReactNode
}

export function Admonition({
  type = 'note',
  title,
  children,
  className = '',
  ...rest
}: AdmonitionProps) {
  return (
    <div
      className={cn(admonitionVariants({ type }), className)}
      role={type === 'warning' || type === 'danger' ? 'alert' : 'note'}
      {...rest}
    >
      <span className="shrink-0">
        {ICON_MAP[type as keyof typeof ICON_MAP]}
      </span>
      <div className="min-w-0 text-sm text-muted leading-relaxed [&>p]:m-0 [&>p]:mb-2 [&>p:last-child]:mb-0">
        {children}
      </div>
    </div>
  )
}

export const Note = (props: Omit<AdmonitionProps, 'type'>) => (
  <Admonition type="note" {...props} />
)
export const Tip = (props: Omit<AdmonitionProps, 'type'>) => (
  <Admonition type="tip" {...props} />
)
export const Warning = (props: Omit<AdmonitionProps, 'type'>) => (
  <Admonition type="warning" {...props} />
)
export const Danger = (props: Omit<AdmonitionProps, 'type'>) => (
  <Admonition type="danger" {...props} />
)
export const InfoBox = (props: Omit<AdmonitionProps, 'type'>) => (
  <Admonition type="info" {...props} />
)
export const Important = (props: Omit<AdmonitionProps, 'type'>) => (
  <Admonition type="important" {...props} />
)
export const Caution = (props: Omit<AdmonitionProps, 'type'>) => (
  <Admonition type="caution" {...props} />
)
