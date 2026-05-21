import { Link } from './link'
import { ChevronLeft, ChevronRight } from '../ui-base/icons'
import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'

export interface PageNavProps extends ComponentBase {
  to: string
  direction: 'prev' | 'next'
}

export const PageNav = ({ children, className }: ComponentBase) => {
  return (
    <nav className={cn('grid sm:grid-cols-2 gap-4', className)}>{children}</nav>
  )
}

const PageNavLink = ({ children, to, direction, className }: PageNavProps) => {
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
      {!isNext && <ChevronLeft className="shrink-0" />}
      <div className="flex flex-col flex-1">{children}</div>
      {isNext && <ChevronRight className="shrink-0" />}
    </Link>
  )
}

const PageNavTitle = ({ children, className }: ComponentBase) => {
  return <span className={cn(className)}>{children}</span>
}

const PageNavDescription = ({ children, className }: ComponentBase) => {
  return <span className={cn('truncate', className)}>{children}</span>
}

const PageNavIcon = ({ children }: ComponentBase) => {
  return <>{children}</>
}

PageNav.Root = PageNav
PageNav.Link = PageNavLink
PageNav.Title = PageNavTitle
PageNav.Description = PageNavDescription
PageNav.Icon = PageNavIcon
