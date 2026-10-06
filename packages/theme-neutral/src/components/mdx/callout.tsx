import { Info, Lightbulb, AlertTriangle, AlertCircle } from '../ui-base/icons'
import { cn } from '../../utils/cn'
import { Callout as CalloutPrimitive } from '../composition/callout'
import type { CalloutVariant } from '../composition/callout'

export type { CalloutVariant }

export interface CalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CalloutVariant
  title?: string
  iconClassName?: string
  titleClassName?: string
  bodyClassName?: string
}

/**
 * Default styled callout.
 *
 * The primitive carries `data-variant` and the stylesheet resolves the five
 * variants from it, so this component's only job is content: which icon, which
 * default title, and the caller's overrides. Adding a variant is a CSS change.
 */
const variantMeta: Record<
  CalloutVariant,
  {
    icon: React.ComponentType<{ className?: string }>
    defaultTitle: string
  }
> = {
  note: { icon: Info, defaultTitle: 'Note' },
  info: { icon: Info, defaultTitle: 'Info' },
  tip: { icon: Lightbulb, defaultTitle: 'Tip' },
  warning: { icon: AlertTriangle, defaultTitle: 'Warning' },
  danger: { icon: AlertCircle, defaultTitle: 'Danger' },
}

export function Callout({
  children,
  className,
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
        <div className={cn('bdocs-callout__accent', iconClassName)}>
          <Icon />
        </div>
      }
      title={
        <div className={cn('bdocs-callout__title', titleClassName)}>
          {title || meta.defaultTitle}
        </div>
      }
      // `prose` stays: the Tailwind Typography plugin styles the callout's inner
      // content by parsing the rendered HTML, which no rule of ours can express.
      // `max-w-none` stops it imposing a measure inside a panel that already has
      // one. Dropping it removed every paragraph margin in the body.
      className={cn(
        'prose prose-neutral dark:prose-invert max-w-none',
        className,
      )}
      bodyClassName={bodyClassName}
      {...props}
    >
      {children}
    </CalloutPrimitive>
  )
}

export default Callout
