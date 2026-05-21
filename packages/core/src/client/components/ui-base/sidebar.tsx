import { Sidebar as SidebarPrimitive } from '../primitives/sidebar'
import { X } from './icons'
import type { ComponentRoute } from '../../types'
import type { BoltdocsConfig } from '../../../shared/types'
import { VersionSelector, I18nSelector } from './version-i18n'
import { ThemeSwitcher } from './theme-toggle'
import { useNavbar } from '../../hooks/use-navbar'
import { useUI } from '../../app/ui-context'
import { Button } from '../primitives/button'

interface SidebarProps {
  routes: ComponentRoute[]
  config: BoltdocsConfig
}

function SidebarMain({ routes, config }: SidebarProps) {
  const { logo, title, logoProps } = useNavbar()
  const { closeSidebar } = useUI()

  const SidebarLogo = logo ? (
    <img
      src={logo}
      alt={logoProps?.alt || title}
      width={24}
      height={24}
      className="rounded-xl"
    />
  ) : null

  const hasUtilities = config.versions || config.i18n

  return (
    <>
      {/* Desktop Version */}
      <SidebarPrimitive.Root>
        <SidebarPrimitive.Content>
          <SidebarPrimitive.Items routes={routes} />
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
            <ThemeSwitcher className="w-24 h-9 rounded-xl" />
            <Button
              onPress={closeSidebar}
              className="h-9 w-9 flex items-center justify-center bg-transparent border-none outline-none select-none cursor-pointer rounded-xl hover:bg-primary-50/50 text-muted hover:text-body transition-colors"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </Button>
          </div>
        </SidebarPrimitive.Header>
        <SidebarPrimitive.Content>
          {hasUtilities && (
            <div className="flex flex-col gap-4 mb-10">
              <div className="flex gap-3">
                {config.versions && (
                  <VersionSelector className="flex-1 justify-between h-10 bg-surface border-subtle rounded-xl" />
                )}
                {config.i18n && (
                  <I18nSelector className="flex-1 justify-between h-10 bg-surface border-subtle rounded-xl" />
                )}
              </div>
              <div className="mt-2 border-b border-subtle" />
            </div>
          )}
          <SidebarPrimitive.Items routes={routes} />
        </SidebarPrimitive.Content>
      </SidebarPrimitive.Mobile>
    </>
  )
}

export const Sidebar = Object.assign(SidebarMain, {
  Root: SidebarPrimitive.Root,
  Mobile: SidebarPrimitive.Mobile,
  Header: SidebarPrimitive.Header,
  Content: SidebarPrimitive.Content,
  Group: SidebarPrimitive.Group,
  Link: SidebarPrimitive.Link,
  SubGroup: SidebarPrimitive.SubGroup,
  Item: SidebarPrimitive.Item,
  Items: SidebarPrimitive.Items,
})
