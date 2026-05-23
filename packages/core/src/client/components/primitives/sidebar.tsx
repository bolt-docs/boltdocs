import {
  type ReactNode,
  useRef,
  useLayoutEffect,
  useEffect,
  useState,
} from 'react'
import * as RAC from 'react-aria-components'
import { cn } from '../../utils/cn'
import { useUI } from '../../app/ui-context'
import { Link } from './link'
import { ChevronRight } from '../ui-base/icons'
import type { ComponentBase } from './types'
import type { ComponentRoute } from '../../types'
import { useSidebar } from '../../hooks/use-sidebar'
import { useLocalizedTo } from '../../hooks/use-localized-to'
import * as DefaultIcons from '../ui-base/icons'
import virtualIcons from 'virtual:boltdocs-icons'

// Persistent scroll position across navigation (SPA)
let sidebarScrollPos = 0

function getIcon(iconName?: string): React.ElementType | undefined {
  if (!iconName) return undefined
  const icons = { ...DefaultIcons, ...virtualIcons } as unknown as Record<
    string,
    React.ElementType
  >
  const IconComponent = icons[iconName] || icons[iconName + 'Icon']
  return IconComponent || undefined
}

/**
 * Internal Badge component for links
 */
const Badge = ({ badge }: { badge: ComponentRoute['badge'] }) => {
  const colors = {
    new: 'bg-primary-500/10 text-primary-500 border border-primary-500/20',
    updated: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    deprecated: 'bg-danger-500/10 text-danger-500 border border-danger-500/20',
  }

  const text = typeof badge === 'string' ? badge : badge?.text
  if (!text) return null

  return (
    <span
      className={cn(
        'ml-auto flex h-5 items-center rounded-md text-[10px] font-bold px-1.5 py-0.5 uppercase tracking-wider',
        colors[text as keyof typeof colors] || colors.new,
      )}
    >
      {text}
    </span>
  )
}

/**
 * Desktop Sidebar Container
 */
export function SidebarRoot({ children, className }: ComponentBase) {
  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col w-sidebar sticky top-navbar h-[calc(100vh-var(--spacing-navbar))] border-r border-subtle bg-main',
        className,
      )}
    >
      {children}
    </aside>
  )
}

/**
 * Mobile Sidebar Modal
 */
export function SidebarMobile({ children, className }: ComponentBase) {
  const { isSidebarOpen, closeSidebar } = useUI()

  return (
    <RAC.ModalOverlay
      isOpen={isSidebarOpen}
      onOpenChange={(open) => !open && closeSidebar()}
      isDismissable={true}
      className={cn(
        'fixed inset-0 z-50 bg-black/20 backdrop-blur-sm lg:hidden',
        'entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out duration-300',
      )}
    >
      <RAC.Modal
        className={cn(
          'fixed top-0 left-0 bottom-0 w-80 bg-main border-r border-subtle shadow-2xl outline-none',
          'entering:animate-in entering:slide-in-from-left exiting:animate-out exiting:slide-out-to-left duration-300',
          className,
        )}
      >
        <RAC.Dialog className="h-full focus:outline-none outline-none flex flex-col">
          {children}
        </RAC.Dialog>
      </RAC.Modal>
    </RAC.ModalOverlay>
  )
}

/**
 * Shared Header for Sidebar
 */
export function SidebarHeader({ children, className }: ComponentBase) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 border-b border-subtle',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Scrollable Content Wrapper
 */
export function SidebarContent({ children, className }: ComponentBase) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Restore scroll position
  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = sidebarScrollPos
    }
  }, [])

  // Save scroll position
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
    <div
      ref={scrollRef}
      className={cn(
        'flex-1 overflow-y-auto p-4 pb-16 custom-scrollbar',
        className,
      )}
    >
      <nav className="flex flex-col gap-6">{children}</nav>
    </div>
  )
}

/**
 * Navigation Group
 */
export const SidebarGroup = ({
  title,
  icon: Icon,
  children,
  className,
}: { title?: string; icon?: React.ElementType } & ComponentBase) => {
  return (
    <div className={className}>
      {title && (
        <h4 className="px-2 mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted/50">
          {Icon && <Icon size={12} />}
          {title}
        </h4>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

/**
 * Sidebar Link
 */
export interface SidebarLinkProps extends ComponentBase {
  label: string
  href: string
  active?: boolean
  icon?: React.ElementType
  badge?: ComponentRoute['badge']
}

export const SidebarLink = ({
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
        'group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-all outline-none',
        active
          ? 'bg-primary-500/10 text-primary-500 font-medium shadow-sm'
          : 'text-muted hover:bg-surface hover:text-body',
        className,
      )}
    >
      {Icon && (
        <Icon
          size={16}
          className={cn(
            active ? 'text-primary-500' : 'text-muted group-hover:text-body',
          )}
        />
      )}
      <span className="truncate">{label}</span>
      {badge && <Badge badge={badge} />}
    </Link>
  )
}

/**
 * Nested SubGroup
 */
export const SidebarSubGroup = ({
  label,
  href,
  active,
  icon: Icon,
  badge,
  isOpen,
  onToggle,
  children,
  className,
}: SidebarLinkProps & {
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}) => {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="group relative flex items-center">
        <SidebarLink
          label={label}
          href={href}
          active={active}
          icon={Icon}
          badge={badge}
          className={cn('flex-1 pr-8', className)}
        />
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggle()
          }}
          className="absolute right-1 p-1.5 text-muted hover:text-body transition-colors outline-none cursor-pointer"
        >
          <ChevronRight
            size={14}
            className={cn(
              'transition-transform duration-200',
              isOpen && 'rotate-90',
            )}
          />
        </button>
      </div>
      {isOpen && (
        <div className="ml-4 pl-3 border-l border-subtle/50 mt-0.5 flex flex-col gap-0.5">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Automated single-route rendering primitive
 */
export interface SidebarItemProps extends ComponentBase {
  route: ComponentRoute
  activePath: string
  activeRoute?: ComponentRoute
}

export function SidebarItem({
  route,
  activePath,
  activeRoute,
  className,
}: SidebarItemProps) {
  const localizedHref = useLocalizedTo(route.path)
  const isCurrent =
    activePath ===
      (localizedHref.endsWith('/')
        ? localizedHref.slice(0, -1)
        : localizedHref) ||
    (!!activeRoute?.filePath &&
      !!route.filePath &&
      activeRoute.filePath === route.filePath)
  const hasChildren = !!route.routes?.length || !!route.subRoutes?.length
  const children = route.routes || route.subRoutes

  const [isOpen, setIsOpen] = useState(
    () =>
      activePath.startsWith(localizedHref) ||
      (!!activeRoute?.filePath &&
        !!route.filePath &&
        activeRoute.filePath === route.filePath),
  )
  const [prevActivePath, setPrevActivePath] = useState(activePath)

  if (activePath !== prevActivePath) {
    setPrevActivePath(activePath)
    if (
      activePath.startsWith(localizedHref) ||
      (!!activeRoute?.filePath &&
        !!route.filePath &&
        activeRoute.filePath === route.filePath)
    ) {
      setIsOpen(true)
    }
  }

  if (hasChildren) {
    return (
      <SidebarSubGroup
        label={route.title}
        href={route.path}
        active={isCurrent}
        icon={getIcon(route.icon)}
        badge={route.badge}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
        className={className}
      >
        {children?.map((subRoute) => (
          <SidebarItem
            key={subRoute.path}
            route={subRoute}
            activePath={activePath}
            activeRoute={activeRoute}
          />
        ))}
      </SidebarSubGroup>
    )
  }

  return (
    <SidebarLink
      label={route.title}
      href={route.path}
      active={isCurrent}
      icon={getIcon(route.icon)}
      badge={route.badge}
      className={className}
    />
  )
}

/**
 * High-level automated routes data rendering primitive
 */
export interface SidebarItemsProps extends ComponentBase {
  routes: ComponentRoute[]
}

export function SidebarItems({ routes, className }: SidebarItemsProps) {
  const { groups, ungrouped, activePath, activeRoute } = useSidebar(routes)

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {ungrouped.length > 0 && (
        <SidebarGroup>
          {ungrouped.map((route) => (
            <SidebarItem
              key={route.path}
              route={route}
              activePath={activePath}
              activeRoute={activeRoute}
            />
          ))}
        </SidebarGroup>
      )}

      {groups.map((group) => (
        <SidebarGroup
          key={group.title}
          title={group.title}
          icon={getIcon(group.icon)}
        >
          {group.routes.map((route) => (
            <SidebarItem
              key={route.path}
              route={route}
              activePath={activePath}
              activeRoute={activeRoute}
            />
          ))}
        </SidebarGroup>
      ))}
    </div>
  )
}

/**
 * Main Sidebar Export
 */
export const Sidebar = Object.assign(SidebarRoot, {
  Root: SidebarRoot,
  Mobile: SidebarMobile,
  Header: SidebarHeader,
  Content: SidebarContent,
  Group: SidebarGroup,
  Link: SidebarLink,
  SubGroup: SidebarSubGroup,
  Item: SidebarItem,
  Items: SidebarItems,
})

export default Sidebar
