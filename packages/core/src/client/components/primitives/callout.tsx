import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'

export type CalloutVariant = 'note' | 'tip' | 'warning' | 'danger' | 'info'

export interface CalloutRootProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'color'> {
  /** The callout variant. Exposed as `data-variant` for theme styling. */
  variant?: CalloutVariant
}

export interface CalloutTitleProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export interface CalloutProps extends CalloutRootProps {
  title?: ReactNode
  /** Custom leading icon. Replaces the default per-variant icon. */
  icon?: ReactNode
  /** Class name for the leading icon wrapper. */
  iconClassName?: string
  /** Class name for the title element. */
  titleClassName?: string
  /** Class name for the body wrapper. */
  bodyClassName?: string
}

/**
 * Style-neutral callout primitives.
 *
 * Own structure and expose state via `data-callout-root` / `data-variant`.
 * No colors, borders, or sizes are baked in — the theme owns all visuals.
 */
function Callout({
  children,
  variant = 'note',
  title,
  icon,
  className,
  iconClassName,
  titleClassName,
  bodyClassName,
  ...props
}: CalloutProps) {
  return (
    <CalloutRoot variant={variant} className={className} {...props}>
      {icon != null && (
        <CalloutIcon className={iconClassName}>{icon}</CalloutIcon>
      )}
      <div className={cn('flex-1', bodyClassName)}>
        {title != null && (
          <CalloutTitle className={titleClassName}>{title}</CalloutTitle>
        )}
        {children}
      </div>
    </CalloutRoot>
  )
}

function CalloutRoot({
  variant,
  children,
  className,
  ...props
}: CalloutRootProps) {
  return (
    <div
      data-callout-root
      data-variant={variant}
      className={cn('flex gap-4', className)}
      {...props}
    >
      {children}
    </div>
  )
}

function CalloutIcon({
  children,
  className,
  ...props
}: Pick<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>) {
  return (
    <div className={cn('shrink-0', className)} {...props}>
      {children}
    </div>
  )
}

function CalloutTitle({
  children,
  className,
  as: Tag = 'div',
  ...props
}: CalloutTitleProps) {
  return (
    <Tag className={className} {...props}>
      {children}
    </Tag>
  )
}

function CalloutBody({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  )
}

Callout.Root = CalloutRoot
Callout.Icon = CalloutIcon
Callout.Title = CalloutTitle
Callout.Body = CalloutBody

export { Callout, CalloutRoot, CalloutIcon, CalloutTitle, CalloutBody }
export default Callout
