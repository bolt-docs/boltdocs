import { useState, useEffect } from 'react'
import { useSidebar } from '../../hooks/use-sidebar'
import { Sidebar as SidebarPrimitive } from '../primitives/sidebar'
import { PoweredBy } from './powered-by'
import * as LucideIcons from 'lucide-react'
import virtualIcons from 'virtual:boltdocs-icons'
import type { ComponentRoute } from '../../types'
import type { BoltdocsConfig } from '../../../shared/types'
import { VersionSelector, I18nSelector } from './version-i18n'
import { ThemeSwitcher } from './theme-toggle'
import { useNavbar } from '../../hooks/use-navbar'
import { useLocalizedTo } from '../../hooks/use-localized-to'
import { useUI } from '../../app/ui-context'
import { Button } from '../primitives/button'

function getIcon(iconName?: string): React.ElementType | undefined {
  if (!iconName) return undefined
  const icons = { ...LucideIcons, ...virtualIcons } as unknown as Record<
    string,
    React.ElementType
  >
  const IconComponent = icons[iconName] || icons[iconName + 'Icon']
  return IconComponent || undefined
}

export function Sidebar({
  routes,
  config,
}: {
  routes: ComponentRoute[]
  config: BoltdocsConfig
}) {
  const { groups, ungrouped, activePath } = useSidebar(routes)
  const { logo, title, logoProps } = useNavbar()
  const { closeSidebar } = useUI()

  const SidebarLogo = logo ? (
    <img
      src={logo}
      alt={logoProps?.alt || title}
      width={24}
      height={24}
      className="rounded-md"
    />
  ) : null

  const hasUtilities = config.versions || config.i18n

  const sidebarContent = (
    <>
      {/* Mobile-only selectors (Below Header) */}
      {hasUtilities && (
        <div className="lg:hidden flex flex-col gap-4 mb-10">
          <div className="flex gap-3">
            {config.versions && (
              <VersionSelector className="flex-1 justify-between h-10 bg-surface border-subtle" />
            )}
            {config.i18n && (
              <I18nSelector className="flex-1 justify-between h-10 bg-surface border-subtle" />
            )}
          </div>
          <div className="mt-2 border-b border-subtle" />
        </div>
      )}

      {ungrouped.length > 0 && (
        <SidebarPrimitive.Group className="mb-6">
          {ungrouped.map((route) => (
            <SidebarRouteItem
              key={route.path}
              route={route}
              activePath={activePath}
            />
          ))}
        </SidebarPrimitive.Group>
      )}

      {groups.map((group) => (
        <SidebarPrimitive.Group 
          key={group.title} 
          title={group.title} 
          icon={getIcon(group.icon)}
        >
          {group.routes.map((route) => (
            <SidebarRouteItem
              key={route.path}
              route={route}
              activePath={activePath}
            />
          ))}
        </SidebarPrimitive.Group>
      ))}

      <div className="mt-auto pt-10 pb-4">
        <PoweredBy />
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Version */}
      <SidebarPrimitive.Root>
        <SidebarPrimitive.Content>
          {sidebarContent}
        </SidebarPrimitive.Content>
      </SidebarPrimitive.Root>

      {/* Mobile Version */}
      <SidebarPrimitive.Mobile>
        <SidebarPrimitive.Header>
          <div className="flex items-center gap-3">
            {SidebarLogo}
            <span className="font-bold text-lg tracking-tight text-body truncate max-w-[120px]">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher className="w-24 h-9" />
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              icon={<LucideIcons.X size={20} />}
              onPress={closeSidebar}
              className="h-9 w-9 text-muted hover:text-body"
              aria-label="Close sidebar"
            />
          </div>
        </SidebarPrimitive.Header>
        <SidebarPrimitive.Content>
          {sidebarContent}
        </SidebarPrimitive.Content>
      </SidebarPrimitive.Mobile>
    </>
  )
}

function SidebarRouteItem({
  route,
  activePath,
}: {
  route: ComponentRoute
  activePath: string
}) {
  const localizedHref = useLocalizedTo(route.path)
  const isCurrent = activePath === (localizedHref.endsWith('/') ? localizedHref.slice(0, -1) : localizedHref)
  const hasChildren = !!route.routes?.length || !!route.subRoutes?.length
  const children = route.routes || route.subRoutes

  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (activePath.startsWith(localizedHref)) {
      setIsOpen(true)
    }
  }, [activePath, localizedHref])

  if (hasChildren) {
    return (
      <SidebarPrimitive.SubGroup
        label={route.title}
        href={route.path}
        active={isCurrent}
        icon={getIcon(route.icon)}
        badge={route.badge}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        {children?.map((subRoute) => (
          <SidebarRouteItem
            key={subRoute.path}
            route={subRoute}
            activePath={activePath}
          />
        ))}
      </SidebarPrimitive.SubGroup>
    )
  }

  return (
    <SidebarPrimitive.Link
      label={route.title}
      href={route.path}
      active={isCurrent}
      icon={getIcon(route.icon)}
      badge={route.badge}
    />
  )
}
