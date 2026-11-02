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
      // The body's rhythm is the theme's, not Tailwind Typography's. This was
      // the last `prose` in the package: it made a callout's typography compile
      // only inside a Tailwind build, and a theme that ships its own CSS cannot
      // ask the host for one. `prose.css` owns the rhythm and tightens it inside
      // a panel, where the page's 20px paragraph margins are too tall.
      className={cn('bdocs-prose', className)}
      bodyClassName={bodyClassName}
      {...props}
    >
      {children}
    </CalloutPrimitive>
  )
}

export default Callout
