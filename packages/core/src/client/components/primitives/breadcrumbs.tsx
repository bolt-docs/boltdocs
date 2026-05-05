import {
  Breadcrumb,
  Breadcrumbs as BreadcrumbsRAC,
} from 'react-aria-components'
import { Link } from './link'
import type { LinkProps } from 'react-aria-components'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'

export const Breadcrumbs = ({
  children,
  className,
  ...props
}: ComponentBase) => {
  return (
    <BreadcrumbsRAC
      className={cn(
        'flex items-center gap-1.5 pl-0! mb-0 text-sm text-muted',
        className,
      )}
      {...props}
    >
      {children as any}
    </BreadcrumbsRAC>
  )
}

const BreadcrumbsItem = ({ children, className, ...props }: ComponentBase) => {
  return (
    <Breadcrumb
      className={cn('flex items-center mb-0 gap-1.5', className)}
      {...props}
    >
      {children as any}
    </Breadcrumb>
  )
}

const BreadcrumbsLink = ({
  children,
  href,
  className,
  ...props
}: LinkProps & { className?: string }) => {
  return (
    <Link
      href={href}
      className={cn(
        'transition-colors outline-none hover:text-body focus-visible:ring-2 focus-visible:ring-primary-500/30 rounded-sm',
        'current:font-medium current:text-body current:pointer-events-none cursor-pointer',
        className,
      )}
      {...props}
    >
      {children as any}
    </Link>
  )
}

const BreadcrumbsSeparator = ({ className }: ComponentBase) => {
  return (
    <ChevronRight
      size={14}
      className={cn('shrink-0 text-dim', className)}
    />
  )
}

Breadcrumbs.Root = Breadcrumbs
Breadcrumbs.Item = BreadcrumbsItem
Breadcrumbs.Link = BreadcrumbsLink
Breadcrumbs.Separator = BreadcrumbsSeparator
