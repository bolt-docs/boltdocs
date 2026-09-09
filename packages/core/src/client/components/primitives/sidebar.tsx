import {
  Fragment,
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
import type { BoltdocsRoutePathWithFallback } from '../../../shared/types'
import {
  useSidebar,
  isRouteActive,
  type SidebarGroupData,
} from '../../hooks/use-sidebar'
import { useLocalizedTo } from '../../hooks/use-localized-to'
import {
  IconRenderer,
  resolveIcon,
  type IconValue,
} from '../ui-base/icon-renderer'

let sidebarScrollPos = 0

function getIcon(iconName?: string) {
  return resolveIcon(iconName)
}

/**
 * Internal Badge component for links.
 *
 * Carries no colors — the theme styles it via `data-badge`.
 */
function Badge({
  badge,
  badgeClassName,
}: {
  badge: ComponentRoute['badge']
  badgeClassName?: string
}) {
  const type = typeof badge === 'string' ? badge : badge?.text
  if (!type) return null

  return (
    <span data-badge={type} className={cn('ml-auto shrink-0', badgeClassName)}>
      {type}
    </span>
  )
}

/**
 * Desktop Sidebar Container
 */
export function SidebarRoot({ children, className }: ComponentBase) {
  return (
    <aside data-sidebar-root className={className}>
      {children}
    </aside>
  )
}

/**
 * Mobile Sidebar Modal
 */
export function SidebarMobile({
  children,
  className,
  overlayClassName,
  dialogClassName,
}: ComponentBase & { overlayClassName?: string; dialogClassName?: string }) {
  const { isSidebarOpen, closeSidebar } = useUI()

  return (
    <RAC.ModalOverlay
      isOpen={isSidebarOpen}
      onOpenChange={(open) => !open && closeSidebar()}
      isDismissable={true}
      className={overlayClassName}
    >
      <RAC.Modal className={className}>
        <RAC.Dialog
          className={cn(
            'h-full flex flex-col outline-none focus:outline-none',
            dialogClassName,
          )}
        >
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
  return <div className={className}>{children}</div>
}

/**
 * Scrollable Content Wrapper
 *
 * The scroll container doubles as the semantic `<nav>` landmark. State and
 * scroll-position handling live here; all visuals belong to the theme.
 */
export function SidebarContent({ children, className }: ComponentBase) {
  const scrollRef = useRef<HTMLElement>(null)

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
    <nav ref={scrollRef} data-sidebar-content className={className}>
      {children}
    </nav>
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
  headerClassName,
  iconClassName,
  titleClassName,
  contentClassName,
  trailing,
  trailingClassName,
  renderTitle,
}: {
  title?: string
  icon?: IconValue
  collapsible?: boolean
  collapsed?: boolean
  active?: boolean
  headerClassName?: string
  iconClassName?: string
  titleClassName?: string
  contentClassName?: string
  trailing?: ReactNode
  /** Class name for the trailing element wrapper (non-collapsible header). */
  trailingClassName?: string
  renderTitle?: (props: { title?: string; isOpen: boolean }) => ReactNode
} & ComponentBase) {
  const [isOpen, setIsOpen] = useState(() => active || !collapsed)

  useEffect(() => {
    if (active) setIsOpen(true)
  }, [active])

  const titleContent = title && (
    <span className={cn('flex items-center gap-2', titleClassName)}>
      {Icon && <IconRenderer icon={Icon} size={12} className={iconClassName} />}
      {title}
    </span>
  )

  return (
    <div
      data-group
      data-active={active || undefined}
      data-collapsible={collapsible || undefined}
      className={className}
    >
      {title &&
        (renderTitle ? (
          renderTitle({ title, isOpen })
        ) : collapsible ? (
          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            data-open={isOpen || undefined}
            className={cn(
              'group flex w-full cursor-pointer items-center justify-between gap-2 text-left outline-none',
              headerClassName,
            )}
          >
            {titleContent}
            {trailing ?? (
              <ChevronRight
                size={12}
                data-open={isOpen || undefined}
                className={cn(
                  'shrink-0 transition-transform duration-200',
                  isOpen && 'rotate-90',
                )}
              />
            )}
          </button>
        ) : (
          <h4
            className={cn(
              'flex items-center gap-2 outline-none',
              headerClassName,
            )}
          >
            {titleContent}
            {trailing && (
              <span className={cn('ml-auto', trailingClassName)}>
                {trailing}
              </span>
            )}
          </h4>
        ))}
      {(!collapsible || isOpen) && (
        <div className={cn('flex flex-col', contentClassName)}>{children}</div>
      )}
    </div>
  )
}

/**
 * Sidebar Link
 */
export interface SidebarLinkProps extends ComponentBase {
  label: string
  href: BoltdocsRoutePathWithFallback
  active?: boolean
  icon?: IconValue
  badge?: ComponentRoute['badge']
  iconClassName?: string
  labelClassName?: string
  badgeClassName?: string
  trailing?: ReactNode
  depth?: number
}

export function SidebarLink({
  label,
  href,
  active,
  icon: Icon,
  badge,
  className,
  iconClassName,
  labelClassName,
  badgeClassName,
  children,
  trailing,
  depth,
}: SidebarLinkProps) {
  const linkRef = useRef<HTMLAnchorElement>(null)

  // Keep the active link visible inside the scroll container.
  useEffect(() => {
    if (active && linkRef.current?.scrollIntoView) {
      linkRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [active])

  return (
    <Link
      ref={linkRef}
      href={href}
      data-active={active || undefined}
      data-depth={depth !== undefined ? depth : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn('group flex items-center gap-2.5 outline-none', className)}
    >
      {Icon && (
        <IconRenderer
          icon={Icon}
          size={16}
          className={cn('shrink-0', iconClassName)}
        />
      )}
      {children ?? (
        <span className={cn('truncate', labelClassName)}>{label}</span>
      )}
      {badge && <Badge badge={badge} badgeClassName={badgeClassName} />}
      {trailing}
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
  rootClassName,
  linkClassName,
  contentClassName,
  toggleClassName,
  wrapperClassName,
  renderToggle,
  depth,
}: SidebarLinkProps & {
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
  rootClassName?: string
  linkClassName?: string
  contentClassName?: string
  toggleClassName?: string
  /** Class name for the relative row that wraps the link and toggle. */
  wrapperClassName?: string
  renderToggle?: (props: { isOpen: boolean }) => ReactNode
}) {
  return (
    <div className={cn('flex flex-col', rootClassName)}>
      <div className={cn('group relative flex items-center', wrapperClassName)}>
        <SidebarLink
          label={label}
          href={href}
          active={active}
          icon={Icon}
          badge={badge}
          depth={depth}
          className={cn('flex-1 pr-8', linkClassName, className)}
        />
        {renderToggle ? (
          renderToggle({ isOpen })
        ) : (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggle()
            }}
            aria-expanded={isOpen}
            data-open={isOpen || undefined}
            className={cn(
              'absolute right-1 cursor-pointer outline-none',
              toggleClassName,
            )}
          >
            <ChevronRight
              size={14}
              data-open={isOpen || undefined}
              className={cn(
                'transition-transform duration-200',
                isOpen && 'rotate-90',
              )}
            />
          </button>
        )}
      </div>
      {isOpen && (
        <div className={cn('flex flex-col', contentClassName)}>{children}</div>
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
  depth?: number
  renderItem?: (route: ComponentRoute, depth: number) => ReactNode
  classNames?: SidebarSlots
}

export function SidebarItem({
  route,
  activePath,
  activeRoute,
  className,
  depth = 0,
  renderItem,
  classNames,
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

  const shouldBeOpen =
    activePath.startsWith(localizedHref) ||
    (!!activeRoute?.filePath &&
      !!route.filePath &&
      activeRoute.filePath === route.filePath)
  const [isOpen, setIsOpen] = useState(() => shouldBeOpen)

  useEffect(() => {
    if (shouldBeOpen) setIsOpen(true)
  }, [shouldBeOpen])

  const renderChild = (subRoute: ComponentRoute) => (
    <Fragment key={subRoute.path}>
      {renderItem ? (
        renderItem(subRoute, depth + 1)
      ) : (
        <SidebarItem
          route={subRoute}
          activePath={activePath}
          activeRoute={activeRoute}
          depth={depth + 1}
          classNames={classNames}
        />
      )}
    </Fragment>
  )

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
        depth={depth}
        rootClassName={classNames?.subgroup}
        linkClassName={cn(classNames?.subgroupLink, className)}
        contentClassName={classNames?.subgroupContent}
        toggleClassName={classNames?.toggle}
        wrapperClassName={classNames?.subgroupWrapper}
      >
        {children?.map(renderChild)}
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
      depth={depth}
      className={cn(classNames?.item, className)}
      iconClassName={classNames?.itemIcon}
      labelClassName={classNames?.itemLabel}
      badgeClassName={classNames?.itemBadge}
    />
  )
}

/**
 * High-level automated routes data rendering primitive
 */
export interface SidebarSlots {
  /** Link root (leaf route) */
  item?: string
  /** Link leading icon */
  itemIcon?: string
  /** Link label */
  itemLabel?: string
  /** Link badge */
  itemBadge?: string
  /** Group root container */
  group?: string
  /** Group header (button or heading) */
  groupHeader?: string
  /** Group leading icon */
  groupIcon?: string
  /** Group title text */
  groupTitle?: string
  /** Group children wrapper */
  groupContent?: string
  /** Subgroup root container */
  subgroup?: string
  /** Subgroup link */
  subgroupLink?: string
  /** Subgroup children wrapper */
  subgroupContent?: string
  /** Subgroup link + toggle row */
  subgroupWrapper?: string
  /** Subgroup expand/collapse toggle */
  toggle?: string
}

export interface SidebarItemRenderProps {
  route: ComponentRoute
  activePath: string
  activeRoute?: ComponentRoute
  isActive: boolean
  depth: number
}

export interface SidebarGroupRenderProps {
  group: SidebarGroupData
  isGroupActive: boolean
  children: ReactNode
}

export interface SidebarItemsProps extends ComponentBase {
  routes: ComponentRoute[]
  /**
   * Per-piece class overrides merged over the default styles.
   */
  classNames?: SidebarSlots
  /**
   * Full render replacement for a single route node (leaf or subgroup).
   * Runs recursively for nested routes.
   */
  componentItem?: (props: SidebarItemRenderProps) => ReactNode
  /**
   * Full render replacement for a top-level group wrapper.
   */
  componentGroup?: (props: SidebarGroupRenderProps) => ReactNode
}

export function SidebarItems({
  routes,
  className,
  classNames,
  componentItem,
  componentGroup,
}: SidebarItemsProps) {
  const { merged, activePath, activeRoute, isGroupActive } = useSidebar(routes)

  const renderItem = (route: ComponentRoute, depth: number): ReactNode => {
    if (componentItem) {
      return componentItem({
        route,
        activePath,
        activeRoute,
        isActive: isRouteActive(route, activePath, activeRoute),
        depth,
      })
    }
    return (
      <SidebarItem
        route={route}
        activePath={activePath}
        activeRoute={activeRoute}
        depth={depth}
        renderItem={renderItem}
        classNames={classNames}
      />
    )
  }

  const renderedElements: ReactNode[] = []
  let currentUngrouped: ComponentRoute[] = []

  const pushUngrouped = () => {
    if (currentUngrouped.length > 0) {
      const routesToRender = [...currentUngrouped]
      renderedElements.push(
        <SidebarGroup
          key={`ungrouped-${routesToRender[0]?.path || 'root'}`}
          className={classNames?.group}
          headerClassName={classNames?.groupHeader}
          iconClassName={classNames?.groupIcon}
          titleClassName={classNames?.groupTitle}
          contentClassName={classNames?.groupContent}
        >
          {routesToRender.map((route) => (
            <Fragment key={route.path}>{renderItem(route, 0)}</Fragment>
          ))}
        </SidebarGroup>,
      )
      currentUngrouped = []
    }
  }

  for (const item of merged) {
    if (item.type === 'link') {
      currentUngrouped.push(item.route)
    } else {
      pushUngrouped()
      const groupActive = isGroupActive(item.group)
      const groupChildren = item.group.routes.map((route) => (
        <Fragment key={route.path}>{renderItem(route, 1)}</Fragment>
      ))
      renderedElements.push(
        componentGroup ? (
          <Fragment key={item.group.title}>
            {componentGroup({
              group: item.group,
              isGroupActive: groupActive,
              children: groupChildren,
            })}
          </Fragment>
        ) : (
          <SidebarGroup
            key={item.group.title}
            title={item.group.title}
            icon={getIcon(item.group.icon)}
            collapsible={item.group.collapsible}
            collapsed={item.group.collapsed}
            active={groupActive}
            className={classNames?.group}
            headerClassName={classNames?.groupHeader}
            iconClassName={classNames?.groupIcon}
            titleClassName={classNames?.groupTitle}
            contentClassName={classNames?.groupContent}
          >
            {groupChildren}
          </SidebarGroup>
        ),
      )
    }
  }
  pushUngrouped()

  return <div className={className}>{renderedElements}</div>
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
