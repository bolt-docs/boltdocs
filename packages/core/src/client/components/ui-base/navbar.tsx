import { Suspense, lazy, useState } from 'react'
import { cn } from '../../utils/cn'
import { useNavbar } from '../../hooks/use-navbar'
import { useRoutes } from '../../hooks/use-routes'
import NavbarPrimitive from '../primitives/navbar'
import { ThemeToggle } from './theme-toggle'
import { GithubStars } from './github-stars'
import { Tabs } from './tabs'
import { useLocation } from 'react-router-dom'
import type { BoltdocsSocialLink } from '../../../shared/types'
import { Button } from '../primitives/button'
import { Menu as MenuIcon, X } from './icons'
import { useLocalizedTo } from '../../hooks/use-localized-to'
import type { NavbarLink as NavbarLinkType } from '../../types'
import { useUI } from '../../app/ui-context'
import { VersionSelector } from './version-selector'
import { I18nSelector } from './i18n-selector'

const SearchDialog = lazy(() =>
  import('./search-dialog').then((m) => ({
    default: m.SearchDialog,
  })),
)

export function Navbar() {
  const { links, title, logo, logoProps, github, social, config } = useNavbar()
  const {
    routes,
    currentRoute,
    isCollectionPage,
    currentVersion,
    currentLocale,
  } = useRoutes()
  const { isSidebarOpen, toggleSidebar } = useUI()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const themeConfig = config.theme || {}
  const isDocs = !!currentRoute?.filePath && !isCollectionPage
  const hasTabs = themeConfig?.tabs && themeConfig.tabs.length > 0

  return (
    <NavbarPrimitive.Root
      className={cn(
        'border-b border-subtle bg-main/80 backdrop-blur-md',
        hasTabs && 'border-b-0',
      )}
    >
      <NavbarPrimitive.Content>
        <NavbarPrimitive.Left>
          {isDocs && (
            <Button
              onPress={toggleSidebar}
              className="mr-2 lg:hidden p-1.5 h-8 w-8 flex items-center justify-center bg-transparent border-none outline-none select-none cursor-pointer rounded-xl hover:bg-primary-50/50 transition-colors"
              aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {isSidebarOpen ? (
                <X className="w-5 h-5 text-body" />
              ) : (
                <MenuIcon className="w-5 h-5 text-body" />
              )}
            </Button>
          )}
          {logo && (
            <NavbarPrimitive.Logo
              src={logo}
              alt={logoProps?.alt || title}
              width={logoProps?.width ?? 24}
              height={logoProps?.height ?? 24}
              href="site:/"
            />
          )}
          <NavbarPrimitive.Title href="site:/">{title}</NavbarPrimitive.Title>

          <div className="hidden sm:block">
            {config.versions && currentVersion && <VersionSelector />}
          </div>
        </NavbarPrimitive.Left>
        <NavbarPrimitive.Center>
          <Suspense
            fallback={
              <div className="h-9 w-32 animate-pulse rounded-md bg-surface" />
            }
          >
            <SearchDialog routes={routes || []} />
          </Suspense>
        </NavbarPrimitive.Center>
        <NavbarPrimitive.Right>
          <Suspense fallback={null}>
            <div className="lg:hidden">
              <SearchDialog routes={routes || []} />
            </div>
          </Suspense>
          <NavbarPrimitive.Links>
            {links.map((link) => (
              <NavbarLinkItem key={link.href} link={link} />
            ))}
          </NavbarPrimitive.Links>

          <div className="hidden sm:flex items-center gap-2">
            {config.i18n && currentLocale && <I18nSelector />}
            <NavbarPrimitive.Split className="bg-subtle" />
          </div>

          <div className="hidden md:block">
            <ThemeToggle />
          </div>

          {github && (
            <div className="hidden md:block">
              <GithubStars repo={themeConfig?.githubRepo ?? ''} />
            </div>
          )}
          {social.length > 0 && (
            <div className="hidden md:block">
              <NavbarPrimitive.Split className="bg-subtle" />
            </div>
          )}
          <div className="hidden md:flex items-center gap-1">
            {social.map(({ icon, link }: BoltdocsSocialLink) => (
              <NavbarPrimitive.Socials
                key={link}
                icon={icon}
                link={link}
                className="p-1.5 text-muted hover:text-body hover:bg-surface rounded-md transition-all focus-visible:ring-2 focus-visible:ring-primary-500/30"
              />
            ))}
          </div>

          <NavbarPrimitive.More
            onPress={() => setIsMobileMenuOpen(true)}
            className="text-muted hover:text-body active:scale-90 transition-all focus-visible:ring-2 focus-visible:ring-primary-500/30"
          />
        </NavbarPrimitive.Right>
      </NavbarPrimitive.Content>

      <NavbarPrimitive.MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        className="bg-main/98 backdrop-blur-2xl"
      >
        <div className="flex flex-col gap-1">
          {links.map((link) => (
            <NavbarMobileLinkItem
              key={link.href}
              link={link}
              onClose={() => setIsMobileMenuOpen(false)}
            />
          ))}
        </div>

        {social.length > 0 && (
          <div className="mt-6">
            <div className="px-4 mb-4 text-xs font-bold uppercase tracking-widest text-muted/50">
              Connect
            </div>
            <div className="flex flex-wrap gap-2 px-2">
              {social.map(({ icon, link }: BoltdocsSocialLink) => (
                <NavbarPrimitive.Socials
                  key={link}
                  icon={icon}
                  link={link}
                  className="p-3 bg-surface border border-subtle rounded-xl flex-1 justify-center"
                />
              ))}
            </div>
          </div>
        )}
      </NavbarPrimitive.MobileMenu>

      {isDocs && hasTabs && themeConfig?.tabs && (
        <div className="w-full border-b border-subtle bg-main">
          <Tabs tabs={themeConfig.tabs} routes={routes || []} />
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
              'transition-colors outline-none font-medium focus-visible:ring-2 focus-visible:ring-primary-500/30 rounded-sm px-2 py-1',
              active ? 'text-primary-500' : 'text-muted hover:text-body',
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
        'transition-colors outline-none font-medium focus-visible:ring-2 focus-visible:ring-primary-500/30 rounded-sm',
        active ? 'text-primary-500' : 'text-muted hover:text-body',
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
  const localizedHref = useLocalizedTo(link.href || '')
  const { pathname } = useLocation()
  const active = pathname === localizedHref
  const hasItems = link.items && link.items.length > 0

  if (hasItems) {
    return (
      <div className="flex flex-col gap-1">
        <div
          className={cn(
            'px-3 py-2 text-sm transition-all',
            active ? 'text-body' : 'text-muted/80 hover:text-body',
          )}
        >
          {link.label as string}
        </div>
        <div className="flex flex-col gap-1 pl-4">
          {link.items?.map((item) => (
            <NavbarMobileLinkItem
              key={item.href}
              link={item}
              onClose={onClose}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <NavbarPrimitive.MobileLink
      {...(link as any)}
      href={localizedHref}
      active={active}
      onPress={onClose}
      className={cn(
        'transition-all',
        active ? 'text-body' : 'text-muted/80 hover:text-body',
      )}
    />
  )
}
