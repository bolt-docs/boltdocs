import {
  Breadcrumb as PrimitivesBreadcrumb,
  Breadcrumbs as PrimitivesBreadcrumbs,
} from '@bdocs/primitives'
import { Link } from './link'
import { ChevronRight } from '../ui-base/icons'
import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'
import type { BoltdocsRoutePathWithFallback } from '@bdocs/runtime'

/**
 * Breadcrumb trail.
 *
 * Structure only: the landmark, the ordered list, and the separator. Everything
 * visible — gaps, the muted last crumb, the chevron — is in
 * `styles/components/breadcrumbs.css`.
 */
export function Breadcrumbs({ children, className, ...props }: ComponentBase) {
  return (
    <PrimitivesBreadcrumbs
      className={cn('bdocs-breadcrumbs', className)}
      {...props}
    >
      {children as any}
    </PrimitivesBreadcrumbs>
  )
}

function BreadcrumbsItem({ children, className, ...props }: ComponentBase) {
  return (
    <PrimitivesBreadcrumb
      className={cn('bdocs-breadcrumbs__item', className)}
      {...props}
    >
      {children as any}
    </PrimitivesBreadcrumb>
  )
}

function BreadcrumbsLink({
  children,
  href,
  className,
  ...props
}: {
  href: BoltdocsRoutePathWithFallback
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn('bdocs-breadcrumbs__link', className)}
      {...props}
    >
      {children as any}
    </Link>
  )
}

/**
 * `data-last` is what lets the final crumb be styled without the theme needing to
 * count children. The trail reads as finished because its tail is muted; a site
 * that adds a breadcrumb should not have to revisit the stylesheet.
 */
function BreadcrumbsSeparator({
  className,
  separator,
  ...props
}: ComponentBase & {
  /** Custom separator icon/component. Replaces the default chevron. */
  separator?: React.ReactNode
}) {
  return (
    <span
      className={cn('bdocs-breadcrumbs__separator', className)}
      data-separator=""
      {...props}
    >
      {separator ?? (
        <ChevronRight size={14} className="bdocs-breadcrumbs__chevron" />
      )}
    </span>
  )
}

Breadcrumbs.Root = Breadcrumbs
Breadcrumbs.Item = BreadcrumbsItem
Breadcrumbs.Link = BreadcrumbsLink
Breadcrumbs.Separator = BreadcrumbsSeparator
