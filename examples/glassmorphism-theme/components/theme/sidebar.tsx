import React, { useState, useEffect } from 'react'
import { 
  PrimitiveSidebar as Sidebar,
  useSidebar,
  useLocalizedTo,
  cn 
} from 'boltdocs/client'

export const CustomSidebar = ({ routes }: any) => {
  const { groups, ungrouped, activePath } = useSidebar(routes)

  const sidebarContent = (
    <>
      {ungrouped.length > 0 && (
        <Sidebar.Group className="mb-8">
          {ungrouped.map((route) => (
            <SidebarRouteItem
              key={route.path}
              route={route}
              activePath={activePath}
            />
          ))}
        </Sidebar.Group>
      )}

      {groups.map((group) => (
        <Sidebar.Group 
          key={group.title} 
          title={group.title} 
          className="mb-8"
        >
          {group.routes.map((route) => (
            <SidebarRouteItem
              key={route.path}
              route={route}
              activePath={activePath}
            />
          ))}
        </Sidebar.Group>
      ))}
    </>
  )

  return (
    <>
      <Sidebar className="boltdocs-sidebar">
        <Sidebar.Content>
          {sidebarContent}
        </Sidebar.Content>
      </Sidebar>

      <Sidebar.Mobile className="boltdocs-sidebar-mobile !bg-black/90 !backdrop-blur-2xl">
        <Sidebar.Header className="border-white/10">
          <div className="text-lg font-bold text-white/90">Navigation</div>
        </Sidebar.Header>
        <Sidebar.Content>
          {sidebarContent}
        </Sidebar.Content>
      </Sidebar.Mobile>
    </>
  )
}

function SidebarRouteItem({ route, activePath }: any) {
  const localizedHref = useLocalizedTo(route.path)
  const isCurrent = activePath === (localizedHref.endsWith('/') && localizedHref.length > 1 ? localizedHref.slice(0, -1) : localizedHref)
  const hasChildren = !!route.routes?.length || !!route.subRoutes?.length
  const children = route.routes || route.subRoutes

  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (activePath.startsWith(localizedHref) && localizedHref !== '/') {
      setIsOpen(true)
    }
  }, [activePath, localizedHref])

  if (hasChildren) {
    return (
      <Sidebar.SubGroup
        label={route.title}
        href={route.path}
        active={isCurrent}
        icon={route.icon}
        badge={route.badge}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
        className="glass-sidebar-item"
      >
        {children?.map((subRoute: any) => (
          <SidebarRouteItem
            key={subRoute.path}
            route={subRoute}
            activePath={activePath}
          />
        ))}
      </Sidebar.SubGroup>
    )
  }

  return (
    <Sidebar.Link
      label={route.title}
      href={route.path}
      active={isCurrent}
      icon={route.icon}
      badge={route.badge}
      className={cn(
        "glass-sidebar-item transition-all duration-300",
        isCurrent && "!bg-primary-500/10 !text-primary-400 !border-l-2 !border-primary-500 !rounded-none"
      )}
    />
  )
}
