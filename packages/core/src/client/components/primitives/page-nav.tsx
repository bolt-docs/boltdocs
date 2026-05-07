import { Link } from './link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'

export interface PageNavProps extends ComponentBase {
  to: string
  direction: 'prev' | 'next'
}

export const PageNav = ({ children, className }: ComponentBase) => {
  return (
    <nav
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 gap-4 mt-12 pt-8 border-t border-subtle',
        className,
      )}
    >
      {children}
    </nav>
  )
}

const PageNavLink = ({ children, to, direction, className }: PageNavProps) => {
  const isNext = direction === 'next'
  return (
    <Link
      href={to}
      className={cn(
        'flex group items-center p-4 rounded-xl border border-subtle bg-surface outline-none no-underline',
        'transition-all hover:bg-primary-500/5 hover:border-primary-500 hover:shadow-lg hover:no-underline',
        'focus-visible:ring-2 focus-visible:ring-primary-500/30',
        isNext ? 'text-right justify-end' : 'text-left justify-start',
        className,
      )}
    >
      {!isNext && (
        <ChevronLeft className="mr-3 h-5 w-5 text-muted group-hover:text-primary-500 transition-transform group-hover:-translate-x-1" />
      )}
      <div className="flex flex-col gap-1 flex-1">{children}</div>
      {isNext && (
        <ChevronRight className="ml-3 h-5 w-5 text-muted group-hover:text-primary-500 transition-transform group-hover:translate-x-1" />
      )}
    </Link>
  )
}

const PageNavTitle = ({ children, className }: ComponentBase) => {
  return (
    <span className={cn('text-xs font-medium uppercase text-muted', className)}>
      {children}
    </span>
  )
}

const PageNavDescription = ({ children, className }: ComponentBase) => {
  return (
    <span className={cn('text-base font-bold text-body truncate', className)}>
      {children}
    </span>
  )
}

const PageNavIcon = ({ children }: ComponentBase) => {
  return <>{children}</>
}

PageNav.Root = PageNav
PageNav.Link = PageNavLink
PageNav.Title = PageNavTitle
PageNav.Description = PageNavDescription
PageNav.Icon = PageNavIcon
