import {
  Breadcrumb as PrimitivesBreadcrumb,
  Breadcrumbs as PrimitivesBreadcrumbs,
} from '@bdocs/primitives'
import { Link } from './link'
import { ChevronRight } from '../ui-base/icons'
import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'
import type { BoltdocsRoutePathWithFallback } from '@bdocs/runtime'

export function Breadcrumbs({ children, className, ...props }: ComponentBase) {
  return (
    <PrimitivesBreadcrumbs
      className={cn('flex flex-wrap items-center', className)}
      {...props}
    >
      {children as any}
    </PrimitivesBreadcrumbs>
  )
}

function BreadcrumbsItem({ children, className, ...props }: ComponentBase) {
  return (
    <PrimitivesBreadcrumb
      className={cn('flex items-center', className)}
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
    <Link href={href} className={cn('cursor-pointer', className)} {...props}>
      {children as any}
    </Link>
  )
}

function BreadcrumbsSeparator({
  className,
  separator,
}: ComponentBase & {
  /** Custom separator icon/component. Replaces the default chevron. */
  separator?: React.ReactNode
}) {
  return (
    <span className={className}>
      {separator ?? <ChevronRight size={14} className="shrink-0" />}
    </span>
  )
}

Breadcrumbs.Root = Breadcrumbs
Breadcrumbs.Item = BreadcrumbsItem
Breadcrumbs.Link = BreadcrumbsLink
Breadcrumbs.Separator = BreadcrumbsSeparator
