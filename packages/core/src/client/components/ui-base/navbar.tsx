import { Suspense, lazy, useState } from 'react'
import { useNavbar } from '../../hooks/use-navbar'
import { useRoutes } from '../../hooks/use-routes'
import NavbarPrimitive from '../primitives/navbar'
import { ThemeToggle } from './theme-toggle'
import { GithubStars } from './github-stars'
import { Tabs } from './tabs'
import { useLocation } from 'react-router-dom'
import type { BoltdocsSocialLink } from '../../../shared/types'
import { Button } from '../primitives/button'
import { Menu as MenuIcon, X } from 'lucide-react'
import { useLocalizedTo } from '../../hooks/use-localized-to'
import type { NavbarLink as NavbarLinkType } from '../../types'
import { useUI } from '../../app/ui-context'
import { VersionSelector, I18nSelector } from './version-i18n'

const SearchDialog = lazy(() =>
  import('./search-dialog').then((m) => ({
    default: m.SearchDialog,
  })),
)

export function Navbar() {
  const { links, title, logo, logoProps, github, social, config } = useNavbar()
  const { routes, allRoutes, currentVersion, currentLocale } = useRoutes()
  const { pathname } = useLocation()
  const { isSidebarOpen, toggleSidebar } = useUI()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const themeConfig = config.theme || {}
  const isDocs = pathname.startsWith('/docs')
  const hasTabs = themeConfig?.tabs && themeConfig.tabs.length > 0

  return (
    <NavbarPrimitive.Root className={hasTabs ? 'border-b-0' : ''}>
      <NavbarPrimitive.Content>
        <NavbarPrimitive.Left>
          {isDocs && (
            <Button
              variant="ghost"
              size="sm"
              className="mr-2 lg:hidden p-1.5 h-8 w-8"
              onPress={toggleSidebar}
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
            <NavbarPrimitive.Split />
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
              <NavbarPrimitive.Split />
            </div>
          )}
          <div className="hidden md:flex items-center gap-1">
            {social.map(({ icon, link }: BoltdocsSocialLink) => (
              <NavbarPrimitive.Socials
                key={link}
                icon={icon}
                link={link}
                className="p-1.5"
              />
            ))}
          </div>

          <NavbarPrimitive.More onPress={() => setIsMobileMenuOpen(true)} />
        </NavbarPrimitive.Right>
      </NavbarPrimitive.Content>

      <NavbarPrimitive.MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        title={title}
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
          <Tabs tabs={themeConfig.tabs} routes={allRoutes || routes || []} />
        </div>
      )}
    </NavbarPrimitive.Root>
  )
}

function NavbarLinkItem({ link }: { link: NavbarLinkType }) {
  const localizedHref = useLocalizedTo(link.href || '')
  return <NavbarPrimitive.Link {...(link as any)} href={localizedHref} />
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

  return (
    <NavbarPrimitive.MobileLink
      {...(link as any)}
      href={localizedHref}
      active={active}
      onPress={onClose}
    />
  )
}
