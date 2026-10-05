import { Info, Lightbulb, AlertTriangle, AlertCircle } from '../ui-base/icons'
import { cn } from '../../utils/cn'
import { Callout as CalloutPrimitive } from '../primitives/callout'
import type { CalloutVariant } from '../primitives/callout'

export type { CalloutVariant }

export interface CalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CalloutVariant
  title?: string
  iconClassName?: string
  titleClassName?: string
  bodyClassName?: string
}

/**
 * Default styled callout. Built on the style-neutral Callout primitive and
 * themed through semantic variant tokens (`--color-{danger|success|warning|info|primary}-500`),
 * so a custom theme can restyle it entirely from CSS.
 */
const variantMeta: Record<
  CalloutVariant,
  {
    container: string
    accent: string
    icon: React.ComponentType<{ className?: string }>
    defaultTitle: string
  }
> = {
  note: {
    container: 'bg-primary-500/10 border-primary-500/50',
    accent: 'text-primary-500',
    icon: Info,
    defaultTitle: 'Note',
  },
  info: {
    container: 'bg-info-500/10 border-info-500/50',
    accent: 'text-info-500',
    icon: Info,
    defaultTitle: 'Info',
  },
  tip: {
    container: 'bg-success-500/10 border-success-500/50',
    accent: 'text-success-500',
    icon: Lightbulb,
    defaultTitle: 'Tip',
  },
  warning: {
    container: 'bg-warning-500/10 border-warning-500/50',
    accent: 'text-warning-500',
    icon: AlertTriangle,
    defaultTitle: 'Warning',
  },
  danger: {
    container: 'bg-danger-500/10 border-danger-500/50',
    accent: 'text-danger-500',
    icon: AlertCircle,
    defaultTitle: 'Danger',
  },
}

export function Callout({
  children,
  className = '',
  variant = 'note',
  title,
  iconClassName,
  titleClassName,
  bodyClassName,
  ...props
}: CalloutProps) {
  const meta = variantMeta[variant] || variantMeta.note
  const Icon = meta.icon

  return (
    <CalloutPrimitive
      variant={variant}
      icon={
        <div className={cn('pt-0.5', meta.accent, iconClassName)}>
          <Icon className="w-5 h-5 stroke-2" />
        </div>
      }
      title={
        <div
          className={cn(
            'font-bold text-sm text-body',
            meta.accent,
            titleClassName,
          )}
        >
          {title || meta.defaultTitle}
        </div>
      }
      className={cn(
        'my-6 rounded-xl border-2 text-body prose prose-neutral dark:prose-invert max-w-none',
        meta.container,
        className,
      )}
      bodyClassName={cn('text-[0.875rem] leading-[1.6]', bodyClassName)}
      {...props}
    >
      {children}
    </CalloutPrimitive>
  )
}

export default Callout
