import { Sidebar as SidebarPrimitive } from '../primitives/sidebar'
import type { SidebarItemsProps, SidebarSlots } from '../primitives/sidebar'
import { X } from './icons'
import type { ComponentRoute } from '../../types'
import type { BoltdocsConfig } from '../../../shared/types'
import { VersionSelector } from './version-selector'
import { I18nSelector } from './i18n-selector'
import { ThemeSwitcher } from './theme-toggle'
import { useNavbar } from '../../hooks/use-navbar'
import { useUI } from '../../app/ui-context'
import { Button } from '../primitives/button'
import { resolvePublicAssetUrl } from '../../utils/path'
import { cn } from '../../utils/cn'

interface SidebarProps {
  routes: ComponentRoute[]
  config: BoltdocsConfig
  className?: string
}

/**
 * Default look for the sidebar tree. States are driven by the primitive's
 * `data-*` attributes (`data-active`, `data-open`, `data-badge`).
 */
const defaultItemsClassNames: SidebarSlots = {
  item: 'rounded-lg px-2.5 py-1.5 text-sm transition-all text-muted hover:bg-surface hover:text-body data-active:bg-primary-500/10 data-active:text-primary-500 data-active:font-medium data-active:shadow-sm',
  groupHeader:
    'px-2 mb-2 text-[11px] font-bold uppercase tracking-widest text-muted/50',
  groupContent: 'gap-0.5',
  subgroup: 'gap-0.5',
  subgroupLink:
    'rounded-lg px-2.5 py-1.5 text-sm transition-all text-muted hover:bg-surface hover:text-body data-active:bg-primary-500/10 data-active:text-primary-500 data-active:font-medium data-active:shadow-sm',
  subgroupContent: 'ml-4 pl-3 border-l border-subtle/50 mt-0.5 gap-0.5',
  toggle: 'p-1.5 text-muted hover:text-body transition-colors',
}

const defaultContentClassName =
  'flex-1 overflow-y-auto p-4 pb-16 custom-scrollbar flex flex-col gap-6'

const mergeSlots = (
  defaults: SidebarSlots,
  overrides?: SidebarSlots,
): SidebarSlots | undefined => {
  if (!overrides) return defaults
  const merged: SidebarSlots = { ...defaults }
  for (const key of Object.keys(defaults) as (keyof SidebarSlots)[]) {
    if (overrides[key]) merged[key] = cn(defaults[key], overrides[key])
  }
  return merged
}

function SidebarMain({ routes, config, className }: SidebarProps) {
  const { logo, title, logoProps } = useNavbar()
  const { closeSidebar } = useUI()

  const SidebarLogo = logo ? (
    <img
      src={resolvePublicAssetUrl(logo, config.base)}
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
      <SidebarPrimitive.Root
        className={cn(
          'hidden lg:flex flex-col w-sidebar sticky top-navbar h-[calc(100vh-var(--spacing-navbar))] border-r border-subtle bg-main',
          className,
        )}
      >
        <SidebarPrimitive.Content className={defaultContentClassName}>
          <SidebarPrimitive.Items
            routes={routes}
            className="flex flex-col gap-6"
            classNames={defaultItemsClassNames}
          />
        </SidebarPrimitive.Content>
      </SidebarPrimitive.Root>

      {/* Mobile Version */}
      <SidebarPrimitive.Mobile
        overlayClassName="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm lg:hidden entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out duration-300"
        className={cn(
          'fixed top-0 left-0 bottom-0 w-80 bg-main border-r border-subtle shadow-2xl outline-none entering:animate-in entering:slide-in-from-left exiting:animate-out exiting:slide-out-to-left duration-300',
          className,
        )}
      >
        <SidebarPrimitive.Header className="flex items-center justify-between p-4 border-b border-subtle">
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
        <SidebarPrimitive.Content className={defaultContentClassName}>
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
          <SidebarPrimitive.Items
            routes={routes}
            className="flex flex-col gap-6"
            classNames={defaultItemsClassNames}
          />
        </SidebarPrimitive.Content>
      </SidebarPrimitive.Mobile>
    </>
  )
}

function SidebarItems(props: SidebarItemsProps) {
  const { classNames, ...rest } = props
  return (
    <SidebarPrimitive.Items
      {...rest}
      className={cn('flex flex-col gap-6', rest.className)}
      classNames={mergeSlots(defaultItemsClassNames, classNames)}
    />
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
  Items: SidebarItems,
})
