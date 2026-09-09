import { Link } from './link'
import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'
import type { BoltdocsRoutePathWithFallback } from '../../../shared/types'

export interface PageNavProps extends ComponentBase {
  to: BoltdocsRoutePathWithFallback
  direction: 'prev' | 'next'
}

export function PageNav({ children, className }: ComponentBase) {
  return (
    <nav className={cn('grid sm:grid-cols-2 gap-4', className)}>{children}</nav>
  )
}

function PageNavLink({ children, to, direction, className }: PageNavProps) {
  const isNext = direction === 'next'
  return (
    <Link
      href={to}
      className={cn(
        'flex items-center outline-none no-underline',
        isNext ? 'justify-end' : 'justify-start',
        className,
      )}
    >
      {children}
    </Link>
  )
}

function PageNavTitle({ children, className }: ComponentBase) {
  return <span className={cn(className)}>{children}</span>
}

function PageNavDescription({ children, className }: ComponentBase) {
  return <span className={cn('truncate', className)}>{children}</span>
}

function PageNavIcon({ children, className }: ComponentBase) {
  return <span className={cn('shrink-0', className)}>{children}</span>
}

PageNav.Root = PageNav
PageNav.Link = PageNavLink
PageNav.Title = PageNavTitle
PageNav.Description = PageNavDescription
PageNav.Icon = PageNavIcon
