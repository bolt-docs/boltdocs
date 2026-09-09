import { Sidebar as SidebarPrimitive } from 'boltdocs/primitives'
import { X } from 'lucide-react'
import type { ComponentRoute } from 'boltdocs/client'
import type { BoltdocsConfig } from 'boltdocs/client'
import { I18nSelector } from '@/theme/i18n-selector'
import { useNavbar } from 'boltdocs/client'
import { useUI } from 'boltdocs/client'
import { Button } from '@/theme/button'
import { resolvePublicAssetUrl } from 'boltdocs/client'

interface SidebarProps {
  routes: ComponentRoute[]
  config: BoltdocsConfig
}

export function Sidebar({ routes, config }: SidebarProps) {
  const { logo, title, logoProps } = useNavbar()
  const { closeSidebar } = useUI()

  const SidebarLogo = logo ? (
    <img
      src={resolvePublicAssetUrl(logo, config.base)}
      alt={logoProps?.alt || title}
      width={24}
      height={24}
      className="rounded-md"
    />
  ) : null

  const hasUtilities = config.versions || config.i18n

  const sidebarClassNames = {
    item: 'rounded-md px-2.5 py-1.5 text-sm transition-colors text-body/80 ml-1 hover:bg-surface hover:text-body data-active:bg-subtle data-active:text-body',
    itemIcon: 'size-4',
    itemLabel: 'truncate',
    itemBadge: 'bg-muted/10 text-xs rounded-full px-2 py-1',
    groupHeader: 'px-2 mb-2 text-sm tracking-normal text-body',
    groupContent: 'flex flex-col gap-0.5',
    subgroupContent:
      'ml-3 pl-3 border-l border-subtle/50 mt-0.5 flex flex-col gap-0.5',
    toggle: 'size-7 rounded-md hover:bg-soft text-muted hover:text-body',
  }

  const contentClassName =
    'flex-1 overflow-y-auto scrollbar-hide mt-5 mb-20 p-0 pr-5 flex flex-col gap-6'

  return (
    <>
      {/* Desktop Version */}
      <SidebarPrimitive.Root className="hidden lg:flex flex-col w-sidebar sticky top-navbar h-[calc(100vh-var(--spacing-navbar))] bg-main ml-5">
        <SidebarPrimitive.Content className={contentClassName}>
          <SidebarPrimitive.Items
            routes={routes}
            className="flex flex-col gap-6"
            classNames={sidebarClassNames}
          />
        </SidebarPrimitive.Content>
      </SidebarPrimitive.Root>

      {/* Mobile Version */}
      <SidebarPrimitive.Mobile
        overlayClassName="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
        className="fixed top-0 left-0 bottom-0 w-80 bg-main border-r border-subtle shadow-2xl outline-none z-9999"
      >
        <SidebarPrimitive.Header className="flex items-center justify-between p-4 border-b border-subtle">
          <div className="flex items-center gap-3">
            {SidebarLogo}
            <span className="font-bold text-lg tracking-tight text-body truncate max-w-30">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onPress={closeSidebar}
              className="text-muted hover:text-body hover:bg-soft"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </Button>
          </div>
        </SidebarPrimitive.Header>
        <SidebarPrimitive.Content className={contentClassName}>
          {hasUtilities && (
            <div className="flex flex-col gap-4 mb-8">
              <div className="flex gap-3">
                {config.i18n && (
                  <I18nSelector className="flex-1 justify-between h-10 bg-main border-subtle rounded-md" />
                )}
              </div>
              <div className="mt-2 border-b border-subtle" />
            </div>
          )}
          <SidebarPrimitive.Items
            routes={routes}
            className="flex flex-col gap-6"
            classNames={sidebarClassNames}
          />
        </SidebarPrimitive.Content>
      </SidebarPrimitive.Mobile>
    </>
  )
}
