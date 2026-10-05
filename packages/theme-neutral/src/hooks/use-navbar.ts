import { useMemo } from 'react'
import { useLocation } from '@bdocs/runtime'
import { useConfig } from '@bdocs/runtime'
import { useTheme } from '@bdocs/runtime'
import type { NavbarLink } from '@bdocs/runtime'
import { getTranslated } from '../utils/i18n'
import { useRoutes } from './use-routes'

export function useNavbar() {
  const config = useConfig()
  const { theme } = useTheme()
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
      const processItems = (items?: any[]): NavbarLink[] | undefined => {
        if (!items || items.length === 0) return undefined
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
  type LogoObject = {
    dark: string
    light: string
    alt?: string
    width?: number
    height?: number
  }

  /**
   * The logo is returned as a pair rather than a single resolved source.
   *
   * Picking the source from `resolvedTheme` looks harmless but cannot work in a
   * server-rendered app: `resolvedTheme` starts as `'light'` and is only
   * corrected in a mount effect, so the server and the browser choose different
   * files. That changes the `<img src>`, which changes the `href` of the
   * `fetchpriority="high"` preload React hoists, which leaves the server HTML
   * holding a preload node the client render never claims. React then discards
   * the whole server tree with hydration error #418.
   *
   * Both sources are handed to the renderer and the active one is selected with
   * CSS, keyed off the `dark` class that a blocking script sets on `<html>`
   * before first paint. The markup is then identical on both sides, there is no
   * wrong-logo flash, and the choice still follows an explicit light/dark
   * setting instead of only the OS preference.
   */
  const logoPair = !logo
    ? null
    : typeof logo === 'string'
      ? { light: logo, dark: null }
      : { light: (logo as LogoObject).light, dark: (logo as LogoObject).dark }

  const logoProps = {
    alt:
      (logo && typeof logo === 'object'
        ? (logo as LogoObject).alt
        : undefined) || title,
    width:
      logo && typeof logo === 'object' ? (logo as LogoObject).width : undefined,
    height:
      logo && typeof logo === 'object'
        ? (logo as LogoObject).height
        : undefined,
  }

  const github = githubRepo ? `https://github.com/${githubRepo}` : null

  return {
    links,
    title,
    logo: logoPair,
    logoProps,
    github,
    social: socialLinks,
    config,
    theme,
  }
}
