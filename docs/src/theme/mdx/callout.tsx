import {
  Callout as CalloutPrimitive,
  type CalloutVariant,
} from 'boltdocs/primitives'
import { cn } from 'boltdocs/client'
import { Info, Lightbulb, AlertTriangle, AlertOctagon } from 'lucide-react'

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
    container: 'bg-primary-500/10',
    accent: 'text-primary-500',
    icon: Info,
    defaultTitle: 'Note',
  },
  info: {
    container: 'bg-info-500/10',
    accent: 'text-info-500',
    icon: Info,
    defaultTitle: 'Info',
  },
  tip: {
    container: 'bg-success-500/10',
    accent: 'text-success-500',
    icon: Lightbulb,
    defaultTitle: 'Tip',
  },
  warning: {
    container: 'bg-warning-500/10',
    accent: 'text-warning-500',
    icon: AlertTriangle,
    defaultTitle: 'Warning',
  },
  danger: {
    container: 'bg-danger-500/10',
    accent: 'text-danger-500',
    icon: AlertOctagon,
    defaultTitle: 'Danger',
  },
}

export function Callout({
  children,
  variant = 'note',
  title,
  ...props
}: CalloutProps) {
  const meta = variantMeta[variant] || variantMeta.note
  const Icon = meta.icon

  return (
    <CalloutPrimitive
      variant={variant}
      icon={<div className={cn('pt-0.5', meta.accent)}></div>}
      className={cn(
        'my-2 rounded-xl p-3 text-body prose prose-neutral dark:prose-invert max-w-none',
        meta.container,
      )}
      {...props}
    >
      <div className="flex items-center gap-2 mb-2">
        <CalloutPrimitive.Icon>
          <Icon className="w-5 h-5 stroke-2" />
        </CalloutPrimitive.Icon>
        <CalloutPrimitive.Title
          className={cn('font-semibold text-sm text-body', meta.accent)}
        >
          {title || meta.defaultTitle}
        </CalloutPrimitive.Title>
      </div>
      <CalloutPrimitive.Body className="">{children}</CalloutPrimitive.Body>
    </CalloutPrimitive>
  )
}
