import { Link } from './link'
import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'
import type { BoltdocsRoutePathWithFallback } from '@bdocs/runtime'

export interface PageNavProps extends ComponentBase {
  to: BoltdocsRoutePathWithFallback
  direction: 'prev' | 'next'
}

/**
 * Structure and accessibility only.
 *
 * `aria-label` and `direction` are the whole contract here. The previous/next
 * distinction travels as `data-direction` rather than as a `--prev` / `--next`
 * class, because a direction is state and the theme styles state from data
 * attributes — the primitives stay free of visual opinions and a theme can
 * restyle the row without the markup changing.
 */
export function PageNav({ children, className }: ComponentBase) {
  return (
    <nav aria-label="Pagination" className={cn('bdocs-page-nav', className)}>
      {children}
    </nav>
  )
}

function PageNavLink({ children, to, direction, className }: PageNavProps) {
  return (
    <Link
      href={to}
      className={cn('bdocs-page-nav__card', className)}
      data-direction={direction}
    >
      {children}
    </Link>
  )
}

function PageNavBody({ children, className }: ComponentBase) {
  return (
    <span className={cn('bdocs-page-nav__body', className)}>{children}</span>
  )
}

function PageNavTitle({ children, className }: ComponentBase) {
  return (
    <span className={cn('bdocs-page-nav__title', className)}>{children}</span>
  )
}

function PageNavDescription({ children, className }: ComponentBase) {
  return (
    <span className={cn('bdocs-page-nav__label', className)}>{children}</span>
  )
}

function PageNavIcon({ children, className }: ComponentBase) {
  return (
    <span className={cn('bdocs-page-nav__icon', className)}>{children}</span>
  )
}

PageNav.Root = PageNav
PageNav.Link = PageNavLink
PageNav.Body = PageNavBody
PageNav.Title = PageNavTitle
PageNav.Description = PageNavDescription
PageNav.Icon = PageNavIcon
