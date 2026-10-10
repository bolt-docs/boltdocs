import { Sidebar as SidebarPrimitive } from '../composition/sidebar'
import type { SidebarItemsProps, SidebarSlots } from '../composition/sidebar'
import { X } from './icons'
import type { ComponentRoute } from '@bdocs/runtime'
import type { BoltdocsConfig } from '@bdocs/runtime'
import { VersionSelector } from './version-selector'
import { I18nSelector } from './i18n-selector'
import { ThemeSwitcher } from './theme-toggle'
import { useNavbar } from '../../hooks/use-navbar'
import { useUI } from '@bdocs/runtime'
import { Button } from '../composition/button'
import { resolvePublicAssetUrl } from '../../utils/path'
import { cn } from '../../utils/cn'

interface SidebarProps {
  routes: ComponentRoute[]
  config: BoltdocsConfig
  className?: string
}

/**
 * Default look for the sidebar tree.
 *
 * Every visible property is in `styles/components/sidebar.css`; the slots here
 * exist so a site can add to or replace one piece without rewriting the
 * stylesheet. States are read from the primitive's `data-*` attributes
 * (`data-active`, `data-open`, `data-badge`) — none of them is a class.
 */
const defaultItemsClassNames: SidebarSlots = {
  item: 'bdocs-sidebar__item',
  groupHeader: 'bdocs-sidebar__group-header',
  groupContent: 'bdocs-sidebar__group-content',
  subgroup: 'bdocs-sidebar__subgroup',
  subgroupLink: 'bdocs-sidebar__subgroup-link',
  subgroupContent: 'bdocs-sidebar__subgroup-content',
  toggle: 'bdocs-sidebar__toggle',
}

const defaultContentClassName = 'bdocs-sidebar__content'

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

  /**
   * Both logo variants are rendered and CSS selects the visible one.
   *
   * Resolving the source from the theme would make the server and the browser
   * emit different `src` values, which is a hydration mismatch. The `dark`
   * class on `<html>` is set before first paint, so there is no flash.
   */
  const SidebarLogo = logo ? (
    logo.dark && logo.dark !== logo.light ? (
      <>
        <img
          src={resolvePublicAssetUrl(logo.light, config.base)}
          alt={logoProps?.alt || title}
          width={24}
          height={24}
          data-logo-theme="light"
          className="bdocs-sidebar__header-logo bdocs-sidebar__header-logo--light"
        />
        <img
          src={resolvePublicAssetUrl(logo.dark, config.base)}
          alt={logoProps?.alt || title}
          width={24}
          height={24}
          data-logo-theme="dark"
          aria-hidden="true"
          className="bdocs-sidebar__header-logo bdocs-sidebar__header-logo--dark"
        />
      </>
    ) : (
      <img
        src={resolvePublicAssetUrl(logo.light, config.base)}
        alt={logoProps?.alt || title}
        width={24}
        height={24}
        className="bdocs-sidebar__header-logo"
      />
    )
  ) : null

  const hasUtilities = config.versions || config.i18n

  return (
    <>
      {/* Desktop Version */}
      <SidebarPrimitive.Root className={className}>
        <SidebarPrimitive.Content className={defaultContentClassName}>
          <SidebarPrimitive.Items
            routes={routes}
            className="bdocs-sidebar__items"
            classNames={defaultItemsClassNames}
          />
        </SidebarPrimitive.Content>
      </SidebarPrimitive.Root>

      {/* Mobile Version */}
      <SidebarPrimitive.Mobile className="bdocs-sidebar__mobile-surface">
        <SidebarPrimitive.Header>
          <div className="bdocs-sidebar__header-brand">
            {SidebarLogo}
            <span className="bdocs-sidebar__header-title">{title}</span>
          </div>
          <div className="bdocs-sidebar__header-actions">
            <ThemeSwitcher className="bdocs-sidebar__theme-switcher" />
            <Button
              onPress={closeSidebar}
              className="bdocs-sidebar__close"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </Button>
          </div>
        </SidebarPrimitive.Header>
        <SidebarPrimitive.Content className={defaultContentClassName}>
          {hasUtilities && (
            <div className="bdocs-sidebar__utilities">
              <div className="bdocs-sidebar__utilities-row">
                {config.versions && (
                  <VersionSelector className="bdocs-sidebar__selector" />
                )}
                {config.i18n && (
                  <I18nSelector className="bdocs-sidebar__selector" />
                )}
              </div>
              <div className="bdocs-sidebar__utilities-divider" />
            </div>
          )}
          <SidebarPrimitive.Items
            routes={routes}
            className="bdocs-sidebar__items"
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
      className={cn('bdocs-sidebar__items', rest.className)}
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
