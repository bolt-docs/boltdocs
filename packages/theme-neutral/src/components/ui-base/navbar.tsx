import { Suspense, lazy, useState } from 'react'
import { cn } from '../../utils/cn'
import { useNavbar } from '../../hooks/use-navbar'
import { useRoutes } from '../../hooks/use-routes'
import NavbarPrimitive from '../composition/navbar'
import { ThemeToggle } from './theme-toggle'
import { Tabs } from './tabs'
import { useLocation } from '@bdocs/runtime'
import type { BoltdocsSocialLink } from '@bdocs/runtime'
import { Button } from '../composition/button'
import { Menu as MenuIcon, X } from './icons'
import { useLocalizedTo } from '../../hooks/use-localized-to'
import type { NavbarLink as NavbarLinkType } from '@bdocs/runtime'
import { useUI } from '@bdocs/runtime'
import { VersionSelector } from './version-selector'
import { I18nSelector } from './i18n-selector'

const SearchDialog = lazy(() =>
  import('./search-dialog').then((m) => ({
    default: m.SearchDialog,
  })),
)

/**
 * The default navbar composition.
 *
 * Structure and behaviour only — every visible property is in
 * `styles/components/navbar.css`. The slots the stylesheet reads are the
 * `bdocs-navbar__*` classes the primitives already emit plus a handful this
 * file adds for the sections it owns directly (the draft chip, the icon rows,
 * the mobile "Connect" group).
 *
 * Where a section is conditional, the breakpoint that shows or hides it is a
 * class on that section rather than a utility on the container: `bdocs-navbar__row`
 * below is what the stylesheet keys the `hidden sm:flex` rule on.
 */
export function Navbar({ className }: { className?: string }) {
  const { links, title, logo, logoProps, social, config } = useNavbar()
  const {
    routes,
    allRoutes,
    currentRoute,
    isCollectionPage,
    currentVersion,
    currentLocale,
  } = useRoutes()
  const { isSidebarOpen, toggleSidebar } = useUI()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const themeConfig = config.theme
  const isDocs = !!currentRoute?.filePath && !isCollectionPage
  const hasTabs = themeConfig?.tabs && themeConfig.tabs.length > 0

  return (
    <NavbarPrimitive.Root
      className={cn(
        'bdocs-navbar--bordered bdocs-navbar--chrome',
        hasTabs && 'bdocs-navbar--flush',
        className,
      )}
    >
      <NavbarPrimitive.Content>
        <NavbarPrimitive.Left>
          {isDocs && (
            <Button
              onPress={toggleSidebar}
              className="bdocs-navbar__menu-toggle"
              aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {isSidebarOpen ? (
                <X className="bdocs-navbar__menu-icon" />
              ) : (
                <MenuIcon className="bdocs-navbar__menu-icon" />
              )}
            </Button>
          )}
          {logo && (
            <NavbarPrimitive.Logo
              src={logo.light}
              srcLight={logo.light}
              srcDark={logo.dark}
              alt={logoProps?.alt || title}
              width={logoProps?.width ?? 24}
              height={logoProps?.height ?? 24}
              href="site:/"
            />
          )}
          <NavbarPrimitive.Title href="site:/">{title}</NavbarPrimitive.Title>

          {currentRoute?.draft && (
            <span className="bdocs-navbar__draft">Draft</span>
          )}

          {/* `hidden sm:block`: the version selector needs room its label does
              not have on a phone, and the mobile menu carries it. */}
          <div className="bdocs-navbar__row">
            {config.versions && currentVersion && <VersionSelector />}
          </div>
        </NavbarPrimitive.Left>
        <NavbarPrimitive.Center>
          <div className="bdocs-navbar__search">
            <Suspense
              fallback={<div className="bdocs-navbar__search-skeleton" />}
            >
              <SearchDialog routes={routes || []} />
            </Suspense>
          </div>
        </NavbarPrimitive.Center>
        <NavbarPrimitive.Right>
          <Suspense fallback={null}>
            <div className="bdocs-navbar__row bdocs-navbar__row--narrow">
              <SearchDialog routes={routes || []} />
            </div>
          </Suspense>
          <NavbarPrimitive.Links>
            {links.map((link) => (
              <NavbarLinkItem key={link.href} link={link} />
            ))}
          </NavbarPrimitive.Links>

          <div className="bdocs-navbar__row bdocs-navbar__row--narrow">
            {config.i18n && currentLocale && <I18nSelector />}
            <NavbarPrimitive.Split className="bdocs-navbar__split--filled" />
          </div>

          <div className="bdocs-navbar__row bdocs-navbar__row--md">
            <ThemeToggle />
          </div>

          {social.length > 0 && (
            <div className="bdocs-navbar__row bdocs-navbar__row--md">
              <NavbarPrimitive.Split className="bdocs-navbar__split--filled" />
            </div>
          )}
          <div className="bdocs-navbar__row bdocs-navbar__row--md-social">
            {social.map(({ icon, link }: BoltdocsSocialLink) => (
              <NavbarPrimitive.Socials
                key={link}
                icon={icon}
                link={link}
                className="bdocs-navbar__social-button"
              />
            ))}
          </div>

          <NavbarPrimitive.More
            onPress={() => setIsMobileMenuOpen(true)}
            className="bdocs-navbar__more-button"
          />
        </NavbarPrimitive.Right>
      </NavbarPrimitive.Content>

      <NavbarPrimitive.MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        className="bdocs-navbar__mobile-surface"
      >
        <div className="bdocs-navbar__mobile-links">
          {links.map((link) => (
            <NavbarMobileLinkItem
              key={link.href}
              link={link}
              onClose={() => setIsMobileMenuOpen(false)}
            />
          ))}
        </div>

        {social.length > 0 && (
          <div className="bdocs-navbar__connect">
            <div className="bdocs-navbar__connect-title">Connect</div>
            <div className="bdocs-navbar__connect-list">
              {social.map(({ icon, link }: BoltdocsSocialLink) => (
                <NavbarPrimitive.Socials
                  key={link}
                  icon={icon}
                  link={link}
                  className="bdocs-navbar__connect-button"
                />
              ))}
            </div>
          </div>
        )}
      </NavbarPrimitive.MobileMenu>

      {isDocs && hasTabs && themeConfig?.tabs && (
        <div className="bdocs-navbar__tabs">
          <Tabs
            tabs={themeConfig.tabs}
            routes={routes || []}
            allRoutes={allRoutes || []}
          />
        </div>
      )}
    </NavbarPrimitive.Root>
  )
}

function NavbarLinkItem({ link }: { link: NavbarLinkType }) {
  const localizedHref = useLocalizedTo(link.href || '')
  const { pathname } = useLocation()
  const active =
    pathname === localizedHref || pathname.startsWith(`${localizedHref}/`)
  const hasItems = link.items && link.items.length > 0

  if (hasItems) {
    return (
      <NavbarPrimitive.Dropdown
        label={
          <span
            className={cn(
              'bdocs-navbar__link-label',
              active && 'bdocs-navbar__link-label--active',
            )}
          >
            {link.label as string}
          </span>
        }
      >
        {link.items?.map((item) => (
          <NavbarPrimitive.DropdownItem
            key={item.href}
            href={useLocalizedTo(item.href || '')}
            label={item.label as any}
          />
        ))}
      </NavbarPrimitive.Dropdown>
    )
  }

  return (
    <NavbarPrimitive.Link
      {...(link as any)}
      href={localizedHref}
      active={active}
      className={cn(
        'bdocs-navbar__link-label',
        active && 'bdocs-navbar__link-label--active',
      )}
    />
  )
}

function NavbarMobileLinkItem({
  link,
  onClose,
}: {
  link: NavbarLinkType
  onClose: () => void
}) {
  return <NavbarPrimitive.MobileLinkItem link={link} onClose={onClose} />
}
