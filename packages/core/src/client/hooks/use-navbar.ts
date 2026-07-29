import { useMemo } from 'react'
import { useLocation } from '../router'
import { useConfig } from '../app/config-context'
import { useTheme } from '../app/theme-context'
import type { NavbarLink } from '../types'
import { getTranslated } from '../utils/i18n'
import { useRoutes } from './use-routes'

export function useNavbar() {
  const config = useConfig()
  const { theme, resolvedTheme } = useTheme()
  const location = useLocation()
  const { currentLocale } = useRoutes()

  const themeConfig = config.theme || {}
  const title = getTranslated(themeConfig.title, currentLocale) || 'Boltdocs'
  const rawLinks = themeConfig.navbar || []
  const socialLinks = themeConfig.socialLinks || []
  const githubRepo = themeConfig.githubRepo

  // Transform links to the new NavbarLink structure
  const links: NavbarLink[] = useMemo(() => {
    return rawLinks.map((item: any) => {
      const href = item.href || item.to || item.link || ''

      // Robust active state calculation
      const getIsActive = (h: string) => {
        const activePath = location.pathname
        if (activePath === h) return true
        if (!h || h === '/') return activePath === '/'

        const cleanPathParts = (p: string) => {
          const parts = p.split('/').filter(Boolean)
          let i = 0
          // Skip locale
          if (
            config.i18n?.locales &&
            parts[i] &&
            !Array.isArray(config.i18n.locales) &&
            config.i18n.locales[parts[i]]
          ) {
            i++
          }
          // Skip version
          if (config.versions?.versions && parts[i]) {
            if (config.versions.versions.some((v) => v.path === parts[i])) {
              i++
            }
          }
          return parts.slice(i)
        }

        const hParts = cleanPathParts(h)
        const pParts = cleanPathParts(activePath)

        if (hParts.length === 0) return pParts.length === 0

        // Must match at least as many parts as the candidate link
        if (pParts.length < hParts.length) return false

        // Every part of hParts must match pParts at the same position
        return hParts.every((part, i) => pParts[i] === part)
      }

      // Process nested items recursively
      const processItems = (items?: any[]): NavbarLink[] => {
        if (!items || items.length === 0) return undefined as any
        return items.map((subItem: any) => {
          const subHref = subItem.href || subItem.to || subItem.link || ''
          return {
            label: getTranslated(subItem.label || subItem.text, currentLocale),
            href: subHref,
            active: getIsActive(subHref),
            to:
              subHref.startsWith('http') || subHref.startsWith('//')
                ? 'external'
                : undefined,
          }
        })
      }

      const linkItems = processItems(item.items)

      return {
        label: getTranslated(item.label || item.text, currentLocale),
        href,
        active: getIsActive(href),
        to:
          href.startsWith('http') || href.startsWith('//')
            ? 'external'
            : undefined,
        items: linkItems,
      }
    })
  }, [rawLinks, location.pathname, currentLocale, config])

  const logo = themeConfig.logo
  // Use resolvedTheme so 'system' correctly maps to 'dark' or 'light'
  // based on the OS preference, instead of always falling back to 'light'.
  const logoSrc = !logo
    ? null
    : typeof logo === 'string'
      ? logo
      : resolvedTheme === 'dark'
        ? (logo as any).dark
        : (logo as any).light

  const logoProps = {
    alt:
      (logo && typeof logo === 'object' ? (logo as any).alt : undefined) ||
      title,
    width: logo && typeof logo === 'object' ? (logo as any).width : undefined,
    height: logo && typeof logo === 'object' ? (logo as any).height : undefined,
  }

  const github = githubRepo ? `https://github.com/${githubRepo}` : null

  return {
    links,
    title,
    logo: logoSrc,
    logoProps,
    github,
    social: socialLinks,
    config,
    theme,
  }
}
