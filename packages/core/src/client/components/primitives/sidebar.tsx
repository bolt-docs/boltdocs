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
function Badge({ badge }: { badge: ComponentRoute['badge'] }) {
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
export function SidebarGroup({
  title,
  icon: Icon,
  children,
  className,
  collapsible = false,
  collapsed = false,
  active = false,
}: {
  title?: string
  icon?: React.ElementType
  collapsible?: boolean
  collapsed?: boolean
  active?: boolean
} & ComponentBase) {
  const [isOpen, setIsOpen] = useState(() => active || !collapsed)
  const [prevActive, setPrevActive] = useState(active)

  if (active !== prevActive) {
    setPrevActive(active)
    if (active) {
      setIsOpen(true)
    }
  }

  return (
    <div className={className}>
      {title &&
        (collapsible ? (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full text-left px-2 mb-2 flex items-center justify-between text-xs font-regular tracking-widest text-muted/50 hover:text-body transition-colors outline-none cursor-pointer group"
          >
            <span className="flex items-center gap-2">
              {Icon && <Icon size={12} />}
              {title}
            </span>
            <ChevronRight
              size={12}
              className={cn(
                'transition-transform duration-200 text-muted/40 group-hover:text-body',
                isOpen && 'rotate-90',
              )}
            />
          </button>
        ) : (
          <h4 className="px-2 mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted/50">
            {Icon && <Icon size={12} />}
            {title}
          </h4>
        ))}
      {(!collapsible || isOpen) && (
        <div className="flex flex-col gap-0.5">{children}</div>
      )}
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

export function SidebarLink({
  label,
  href,
  active,
  icon: Icon,
  badge,
  className,
}: SidebarLinkProps) {
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
export function SidebarSubGroup({
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
}) {
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

const isRouteActive = (
  route: any,
  activePath: string,
  activeRoute?: any,
): boolean => {
  const normalizedPath = route.path.endsWith('/')
    ? route.path.slice(0, -1)
    : route.path
  const normalizedActive = activePath.endsWith('/')
    ? activePath.slice(0, -1)
    : activePath

  if (normalizedActive === normalizedPath) return true
  if (
    activeRoute?.filePath &&
    route.filePath &&
    activeRoute.filePath === route.filePath
  )
    return true

  if (
    route.routes &&
    route.routes.some((r: any) => isRouteActive(r, activePath, activeRoute))
  )
    return true
  if (
    route.subRoutes &&
    route.subRoutes.some((r: any) => isRouteActive(r, activePath, activeRoute))
  )
    return true

  return false
}

export function SidebarItems({ routes, className }: SidebarItemsProps) {
  const { groups, ungrouped, activePath, activeRoute } = useSidebar(routes)

  // Merge groups and ungrouped into a single sorted list
  const mergedItems = [
    ...ungrouped.map((route) => ({
      type: 'link' as const,
      position: route.sidebarPosition ?? 999,
      title: route.title,
      route,
    })),
    ...groups.map((group) => ({
      type: 'group' as const,
      position: (group as any).sidebarPosition ?? 999,
      title: group.title,
      group,
    })),
  ].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position
    if (a.type !== b.type) {
      return a.type === 'link' ? -1 : 1
    }
    return a.title.localeCompare(b.title)
  })

  const renderedElements: ReactNode[] = []
  let currentUngrouped: ComponentRoute[] = []

  const pushUngrouped = () => {
    if (currentUngrouped.length > 0) {
      const routesToRender = [...currentUngrouped]
      renderedElements.push(
        <SidebarGroup key={`ungrouped-${routesToRender[0].path}`}>
          {routesToRender.map((route) => (
            <SidebarItem
              key={route.path}
              route={route}
              activePath={activePath}
              activeRoute={activeRoute}
            />
          ))}
        </SidebarGroup>,
      )
      currentUngrouped = []
    }
  }

  for (const item of mergedItems) {
    if (item.type === 'link') {
      currentUngrouped.push(item.route)
    } else {
      pushUngrouped()
      const isGroupActive = item.group.routes.some((route: any) =>
        isRouteActive(route, activePath, activeRoute),
      )
      renderedElements.push(
        <SidebarGroup
          key={item.group.title}
          title={item.group.title}
          icon={getIcon(item.group.icon)}
          collapsible={item.group.collapsible}
          collapsed={item.group.collapsed}
          active={isGroupActive}
        >
          {item.group.routes.map((route: any) => (
            <SidebarItem
              key={route.path}
              route={route}
              activePath={activePath}
              activeRoute={activeRoute}
            />
          ))}
        </SidebarGroup>,
      )
    }
  }
  pushUngrouped()

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {renderedElements}
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
