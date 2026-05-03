import { useRef, useEffect, useLayoutEffect } from 'react'
import { Link } from './link'
import * as RAC from 'react-aria-components'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'
import type { ComponentRoute } from '../../types'

export interface SidebarGroupProps extends ComponentBase {
  title?: string
  icon?: React.ElementType
}

export interface SidebarSubGroupProps extends SidebarLinkProps {
  isOpen?: boolean
  onToggle?: () => void
  children?: React.ReactNode
}

export interface SidebarLinkProps extends ComponentBase {
  label: string
  href: string
  active?: boolean
  icon?: React.ElementType
  badge?: ComponentRoute['badge']
}

const Badge = ({ badge }: { badge: ComponentRoute['badge'] }) => {
  const colors = {
    new: 'bg-primary-500/20 text-primary-500',
    updated: 'bg-gray-500/20 text-gray-500',
    deprecated: 'bg-red-500/20 text-red-500',
  }

  // Expire Badge
  if (typeof badge === 'object' && badge?.expires) {
    const expireDate = new Date(badge.expires)
    const today = new Date()
    const diffTime = expireDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return null
    }
  }

  const text = typeof badge === 'string' ? badge : badge?.text

  return (
    <span
      className={cn(
        'ml-auto flex h-4.5 items-center rounded-full text-[9px] font-medium px-1.5 py-0.5 text-center whitespace-nowrap',
        colors[text as keyof typeof colors] || colors.new,
      )}
    >
      {text}
    </span>
  )
}

// Persistent scroll position across navigation (SPA)
let sidebarScrollPos = 0

export const Sidebar = ({ children, className }: ComponentBase) => {
  const scrollRef = useRef<HTMLElement>(null)

  // Restore scroll position on mount
  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = sidebarScrollPos
    }
  }, [])

  // Save scroll position on scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      sidebarScrollPos = el.scrollTop
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <aside
      ref={scrollRef}
      className={cn(
        'boltdocs-sidebar sticky top-navbar hidden lg:flex flex-col shrink-0',
        'w-sidebar h-full',
        'overflow-y-auto border-r border-border-subtle bg-bg-main',
        'py-6 px-4',
        className,
      )}
    >
      <nav className="flex-1 space-y-6">{children}</nav>
    </aside>
  )
}

const SidebarGroup = ({
  children,
  title,
  icon: Icon,
  className,
}: SidebarGroupProps) => {
  return (
    <div className={cn('space-y-1', className)}>
      {title && (
        <div
          className={cn(
            'flex w-full items-center justify-between px-2 py-1.5 text-sm font-semibold',
            'text-text-main',
          )}
        >
          <div className="flex items-center gap-2">
            {Icon && <Icon size={14} />}
            {title}
          </div>
        </div>
      )}
      {children && <div className="space-y-0.5">{children}</div>}
    </div>
  )
}

const SidebarGroupItem = ({ children, className }: ComponentBase) => {
  return <div className={cn(className)}>{children}</div>
}

const SidebarLink = ({
  label,
  href,
  active,
  icon: Icon,
  badge,
  className,
}: SidebarLinkProps) => {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none',
        'transition-all duration-200 ease-in-out',
        'focus-visible:ring-2 focus-visible:ring-primary-500/30',
        {
          'bg-primary-500/10 text-primary-500 font-medium': active,
          'text-text-muted hover:bg-bg-muted hover:text-text-main': !active,
        },
        className,
      )}
    >
      {Icon && (
        <Icon
          size={16}
          className={cn(
            active
              ? 'text-primary-500'
              : 'text-text-muted group-hover:text-text-main',
          )}
        />
      )}
      <span className="truncate">{label}</span>
      {badge && <Badge badge={badge} />}
    </Link>
  )
}

const SidebarSubGroup = ({
  label,
  href,
  active,
  icon: Icon,
  badge,
  className,
  isOpen = false,
  onToggle,
  children,
}: SidebarSubGroupProps) => {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center w-full">
        <Link
          href={href}
          className={cn(
            'group flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none',
            'transition-all duration-200 ease-in-out',
            'focus-visible:ring-2 focus-visible:ring-primary-500/30',
            active
              ? 'bg-primary-500/10 text-primary-500 font-medium'
              : 'text-text-muted hover:bg-bg-surface hover:text-text-main hover:translate-x-1',
            className,
          )}
        >
          {Icon && (
            <Icon
              size={16}
              className={cn(
                active
                  ? 'text-primary-500'
                  : 'text-text-muted group-hover:text-text-main',
              )}
            />
          )}
          <span className="truncate">{label}</span>
          {badge && <Badge badge={badge} />}
        </Link>
        {children && (
          <RAC.Button
            onPress={onToggle}
            className="flex items-center justify-center p-1.5 ml-1 rounded-md text-text-muted hover:bg-bg-surface hover:text-text-main transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 cursor-pointer"
          >
            <ChevronRight
              size={16}
              className={cn(
                'transition-transform duration-200',
                isOpen && 'rotate-90',
              )}
            />
          </RAC.Button>
        )}
      </div>
      {isOpen && children && (
        <div className="pl-4 ml-[7px] border-l border-border-subtle/50 space-y-0.5 mt-0.5">
          {children}
        </div>
      )}
    </div>
  )
}

Sidebar.Root = Sidebar
Sidebar.Group = SidebarGroup
Sidebar.SubGroup = SidebarSubGroup
Sidebar.GroupItem = SidebarGroupItem
Sidebar.Link = SidebarLink
