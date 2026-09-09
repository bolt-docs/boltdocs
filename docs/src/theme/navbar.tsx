import { useState } from 'react'
import { cn } from 'boltdocs/client'
import { useNavbar } from 'boltdocs/client'
import { useRoutes } from 'boltdocs/client'
import { Navbar as NavbarPrimitive } from 'boltdocs/primitives'
import { Button } from '@/theme/button'
import { ChevronDown, Menu as MenuIcon, X } from 'lucide-react'
import { Github } from '@/theme/icons'
import { useLocation } from 'boltdocs/client'
import { useLocalizedTo } from 'boltdocs/client'
import { useUI } from 'boltdocs/client'
import { SearchDialog } from '@/theme/search-dialog'
import { I18nSelector } from '@/theme/i18n-selector'
import { DocsTabs } from '@/theme/tabs'
import type { NavbarLink as NavbarLinkType } from 'boltdocs/client'

export function Navbar() {
  const { links, title, logo, logoProps, github, config } = useNavbar()
  const { routes, allRoutes, currentRoute, isCollectionPage, currentLocale } =
    useRoutes()
  const { isSidebarOpen, toggleSidebar } = useUI()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const themeConfig = config.theme
  const isDocs = !!currentRoute?.filePath && !isCollectionPage
  const hasTabs = themeConfig?.tabs && themeConfig.tabs.length > 0

  return (
    <NavbarPrimitive.Root className={cn('bg-main', hasTabs && 'border-b-0')}>
      <NavbarPrimitive.Content
        className={cn('max-w-7xl max-sm:px-10 px-0', {
          'max-w-full': isDocs && hasTabs,
        })}
      >
        <NavbarPrimitive.Left>
          {isDocs && (
            <Button
              variant="ghost"
              size="icon"
              onPress={toggleSidebar}
              className="mr-2 lg:hidden rounded-md hover:bg-soft"
              aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {isSidebarOpen ? (
                <X className="w-5 h-5 text-body" />
              ) : (
                <MenuIcon className="size-24 text-body" />
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

          {currentRoute?.draft && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-500/15 text-warning-500 border border-warning-500/25">
              Draft
            </span>
          )}
        </NavbarPrimitive.Left>
        <NavbarPrimitive.Center>
          <SearchDialog routes={routes || []} />
        </NavbarPrimitive.Center>
        <NavbarPrimitive.Right>
          <div className="lg:hidden flex items-center gap-1">
            <SearchDialog routes={routes || []} />
          </div>
          <NavbarPrimitive.Links className="hidden lg:flex items-center gap-2">
            {links.map((link) => (
              <NavbarLinkItem key={link.href} link={link} />
            ))}
          </NavbarPrimitive.Links>

          <div className="hidden sm:flex items-center gap-2">
            {config.i18n && currentLocale && <I18nSelector />}
            <NavbarPrimitive.Split className="bg-subtle" />
          </div>

          {github && (
            <a
              href={github}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center justify-center size-9 rounded-md text-muted hover:text-body hover:bg-soft transition-colors outline-none"
              aria-label="GitHub repository"
            >
              <Github className="h-4.5 w-4.5" />
            </a>
          )}

          <NavbarPrimitive.More
            onPress={() => setIsMobileMenuOpen(true)}
            className="text-muted hover:text-body transition-colors outline-none"
          />
        </NavbarPrimitive.Right>
      </NavbarPrimitive.Content>

      <NavbarPrimitive.MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        className="bg-main"
      >
        <div className="flex flex-col gap-1">
          {links.map((link) => (
            <NavbarPrimitive.MobileLinkItem
              key={link.href}
              link={link}
              onClose={() => setIsMobileMenuOpen(false)}
            />
          ))}
        </div>
        {github && (
          <a
            href={github}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-muted hover:text-body hover:bg-soft rounded-lg transition-colors"
          >
            <Github className="size-16" />
            GitHub
          </a>
        )}
      </NavbarPrimitive.MobileMenu>

      {isDocs && hasTabs && themeConfig?.tabs && (
        <div className="w-full bg-main">
          <DocsTabs
            tabs={themeConfig.tabs as never}
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
        className="group"
        icon={
          <ChevronDown className="size-5 transition-transform group-hover:rotate-180 text-muted" />
        }
        menuClassName="bg-subtle border border-subtle rounded-lg"
        triggerClassName={cn('rounded-sm px-1', {
          'text-body bg-subtle': active,
          'hover:bg-surface/50': !active,
        })}
        label={
          <span
            className={cn(
              'transition-colors outline-none font-medium text-sm  px-2 py-1',
            )}
          >
            {link.label as string}
          </span>
        }
      >
        {link.items?.map((item) => (
          <NavbarPrimitive.DropdownItem
            className="rounded-md"
            key={item.href}
            href={useLocalizedTo(item.href || '')}
            label={item.label as never}
          />
        ))}
      </NavbarPrimitive.Dropdown>
    )
  }

  return (
    <NavbarPrimitive.Link
      label={link.label as never}
      href={localizedHref}
      className={cn(
        'transition-colors outline-none font-medium py-1 px-2 text-sm rounded-md',
        active
          ? 'text-body bg-subtle'
          : 'text-muted hover:text-body hover:bg-surface',
      )}
    />
  )
}
