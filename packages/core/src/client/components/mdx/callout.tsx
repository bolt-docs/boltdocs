import { Info, Lightbulb, AlertTriangle, AlertCircle } from 'lucide-react'
import { cn } from '../../utils/cn'

export type CalloutVariant = 'note' | 'tip' | 'warning' | 'danger' | 'info'

export interface CalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CalloutVariant
  title?: string
}

const variantStyles: Record<
  CalloutVariant,
  {
    container: string
    titleText: string
    iconColor: string
    icon: React.ComponentType<any>
    defaultTitle: string
  }
> = {
  note: {
    container:
      'bg-slate-500/5 dark:bg-slate-500/10 border-slate-500/40 text-slate-800 dark:text-slate-200',
    titleText: 'text-slate-900 dark:text-slate-100',
    iconColor: 'text-slate-500',
    icon: Info,
    defaultTitle: 'Note',
  },
  info: {
    container:
      'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500/40 text-indigo-800 dark:text-indigo-200',
    titleText: 'text-indigo-900 dark:text-indigo-100',
    iconColor: 'text-indigo-500',
    icon: Info,
    defaultTitle: 'Info',
  },
  tip: {
    container:
      'bg-green-500/5 dark:bg-green-500/10 border-green-500/40 text-green-800 dark:text-green-200',
    titleText: 'text-green-900 dark:text-green-100',
    iconColor: 'text-green-500',
    icon: Lightbulb,
    defaultTitle: 'Tip',
  },
  warning: {
    container:
      'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-200',
    titleText: 'text-amber-900 dark:text-amber-100',
    iconColor: 'text-amber-500',
    icon: AlertTriangle,
    defaultTitle: 'Warning',
  },
  danger: {
    container:
      'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/40 text-rose-800 dark:text-rose-200',
    titleText: 'text-rose-900 dark:text-rose-100',
    iconColor: 'text-rose-500',
    icon: AlertCircle,
    defaultTitle: 'Danger',
  },
}

export function Callout({
  children,
  className = '',
  variant = 'note',
  title,
  ...props
}: CalloutProps) {
  const styles = variantStyles[variant] || variantStyles.note
  const Icon = styles.icon

  return (
    <div
      className={cn(
        'my-6 flex gap-4 p-4 rounded-xl border-2',
        styles.container,
        className,
      )}
      {...props}
    >
      <div className={cn('shrink-0 pt-0.5', styles.iconColor)}>
        <Icon className="w-5 h-5 stroke-[2]" />
      </div>
      <div className="flex-1 text-[0.875rem] leading-[1.6]">
        <div className={cn('font-bold text-sm mb-1', styles.titleText)}>
          {title || styles.defaultTitle}
        </div>
        <div className="prose prose-neutral dark:prose-invert max-w-none [&>p]:m-0 [&>p+p]:mt-2">
          {children}
        </div>
      </div>
    </div>
  )
}

export default Callout
