import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBaseFilePath } from '../utils/get-base-file-path'
import { useRoutes } from './use-routes'
import { useConfig } from '../app/config-context'
import { useBoltdocsContext } from '../store/boltdocs-context'
import type { BoltdocsLocale } from '../../shared/types'

export interface LocaleOption {
  key: BoltdocsLocale
  label: string
  value: string
  isCurrent: boolean
}

export interface UseI18nReturn {
  currentLocale: BoltdocsLocale | undefined
  currentLocaleLabel: string | undefined
  availableLocales: LocaleOption[]
  handleLocaleChange: (locale: BoltdocsLocale) => void
}

/**
 * Hook to manage and switch between different locales (languages) of the documentation.
 */
export function useI18n(): UseI18nReturn {
  const navigate = useNavigate()
  const config = useConfig()
  const { allRoutes, currentRoute, currentLocale, currentVersion } = useRoutes()
  const i18n = config.i18n
  const { setLocale } = useBoltdocsContext()

  const handleLocaleChange = (locale: string) => {
    if (!i18n || locale === currentLocale) return

    // Update store
    setLocale(locale)

    const base = config.base || '/'
    const safeBase = base === '/' ? '' : base.replace(/\/$/, '')
    const isDocsPath = currentRoute?.path?.startsWith(safeBase)

    let targetPath = ''

    if (currentRoute) {
      // Case A: We are on a known route. Determine if it is doc or external.
      if (isDocsPath) {
        // Documentation Context logic
        const baseFile = getBaseFilePath(
          currentRoute.filePath,
          currentRoute.version,
          currentRoute.locale,
        )

        const targetRoute = allRoutes.find(
          (r) =>
            getBaseFilePath(r.filePath, r.version, r.locale) === baseFile &&
            (r.locale || i18n.defaultLocale) === locale &&
            r.version === currentRoute.version,
        )

        if (targetRoute) {
          targetPath = targetRoute.path
        } else {
          // Recovery: Find target index, or hardcode reconstruct using version space
          const defaultIndexRoute = allRoutes.find(
            (r) =>
              getBaseFilePath(r.filePath, r.version, r.locale) === 'index.md' &&
              (r.locale || i18n.defaultLocale) === locale &&
              r.version === currentRoute.version,
          )

          if (defaultIndexRoute) {
            targetPath = defaultIndexRoute.path
          } else {
            // Hardcoded absolute construction preserving existing version structure
            const vPath = currentRoute.version ? `/${currentRoute.version}` : ''
            const lPath = locale === i18n.defaultLocale ? '' : `/${locale}`
            targetPath = `${safeBase}${vPath}${lPath}` || '/'
          }
        }
      } else {
        // External Context Logic: simply rewrite the current absolute path
        // Extract pure relative component by stripping existing locale prefix
        let rawExternal = currentRoute.path

        // Strip existing locale if any
        const parts = rawExternal.split('/').filter(Boolean)
        if (
          parts.length > 0 &&
          (Array.isArray(i18n.locales)
            ? i18n.locales.includes(parts[0])
            : !!i18n.locales[parts[0]])
        ) {
          // Already prefixed external route like /es/about -> become /about
          parts.shift()
          rawExternal = '/' + parts.join('/')
        }

        // Re-apply new locale
        if (locale === i18n.defaultLocale) {
          targetPath = rawExternal === '' ? '/' : rawExternal
        } else {
          const cleanExt = rawExternal.startsWith('/')
            ? rawExternal
            : `/${rawExternal}`
          targetPath = `/${locale}${cleanExt === '/' ? '' : cleanExt}`
        }
      }
    } else {
      // Case B: Fallback for Unknown / 404 page
      // Try to find first available page that matches the intended combo
      const targetRoute = allRoutes.find(
        (r) =>
          (r.locale || i18n.defaultLocale) === locale &&
          (r.version || config.versions?.defaultVersion) ===
            (currentVersion || config.versions?.defaultVersion),
      )

      if (targetRoute) {
        targetPath = targetRoute.path
      } else {
        const vPath =
          currentVersion && currentVersion !== config.versions?.defaultVersion
            ? `/${currentVersion}`
            : ''
        targetPath =
          locale === i18n.defaultLocale
            ? `${safeBase}${vPath}`
            : `${safeBase}${vPath}/${locale}`
      }
    }

    // Final safety check: cleanup double slashes and empty targets
    if (!targetPath || targetPath === '') targetPath = '/'
    targetPath = targetPath.replace(/\/+/g, '/')

    navigate(targetPath)
  }

  const locales = i18n?.locales
  const defaultLabel = locales
    ? Array.isArray(locales)
      ? currentLocale
      : (locales as Record<string, string>)[currentLocale as string]
    : undefined

  const currentLocaleConfig = i18n?.localeConfigs?.[currentLocale as string]
  const currentLocaleLabel =
    currentLocaleConfig?.label || defaultLabel || currentLocale

  const availableLocales = useMemo(() => {
    return i18n
      ? Array.isArray(i18n.locales)
        ? i18n.locales.map((key) => {
            const localeConfig = i18n?.localeConfigs?.[key]
            return {
              key: key as BoltdocsLocale,
              label: localeConfig?.label || key,
              value: key,
              isCurrent: key === currentLocale,
            }
          })
        : Object.entries(i18n.locales).map(([key, label]) => {
            const localeConfig = i18n?.localeConfigs?.[key]
            return {
              key: key as BoltdocsLocale,
              label: localeConfig?.label || label,
              value: key,
              isCurrent: key === currentLocale,
            }
          })
      : []
  }, [i18n, currentLocale])

  return {
    currentLocale,
    currentLocaleLabel,
    availableLocales,
    handleLocaleChange,
  }
}
