import { useMemo } from 'react'
import { useLocation, useNavigate } from '../router'
import { getBaseFilePath } from '../utils/get-base-file-path'
import {
  addUrlBase,
  getConfiguredLocales,
  getVersionPrefixSegments,
  isConfiguredVersion,
  normalizeUrlPath,
  stripUrlBase,
} from '../router/url-contract'
import { useRoutes } from './use-routes'
import { useConfig } from '../app/config-context'
import { useBoltdocsContext } from '../store/boltdocs-context'
import type { BoltdocsLocale } from '../../shared/types'
import type { UrlContractConfig } from '../router/url-contract'

function matchConfiguredVersion(
  parts: string[],
  start: number,
  config: UrlContractConfig,
): { version?: string; nextIndex: number } {
  const prefix = getVersionPrefixSegments(config)
  const versionIndex = start + prefix.length
  const hasPrefix = prefix.every(
    (segment, index) => parts[start + index] === segment,
  )

  if (!hasPrefix || !isConfiguredVersion(parts[versionIndex], config)) {
    return { nextIndex: start }
  }

  return {
    version: parts[versionIndex],
    nextIndex: versionIndex + 1,
  }
}

function parsePathForLocaleSwitch(
  pathname: string,
  config: UrlContractConfig,
  targetLocale: string,
  defaultLocale: string,
  collectionName?: string,
): string {
  // Strip the base path first (e.g., /docs)
  const baseStripped = stripUrlBase(pathname, config.base)

  // Parse the path without the base
  const parts = normalizeUrlPath(baseStripped).split('/').filter(Boolean)
  let index = 0

  // Skip version prefix
  const versionMatch = matchConfiguredVersion(parts, index, config)
  index = versionMatch.nextIndex

  // Check for locale at current position
  const configuredLocales = getConfiguredLocales(config)
  const hasLocale = configuredLocales.includes(parts[index] || '')

  // Check if this is a collection root page (path is just the collection name after base/version)
  // Collection root pages are locale-independent and should not change URL when switching locale
  const isCollectionRoot =
    collectionName &&
    parts.length === index + 1 &&
    parts[index] === collectionName &&
    !hasLocale

  if (isCollectionRoot) {
    // Collection root page - return the original path unchanged
    return pathname
  }

  if (hasLocale) {
    // Remove old locale
    parts.splice(index, 1)
  }

  // Insert new locale (if not default)
  if (targetLocale !== defaultLocale) {
    parts.splice(index, 0, targetLocale)
  }

  // Rebuild the path with the base
  const newBaseStripped = '/' + parts.join('/') || '/'
  return addUrlBase(newBaseStripped, config.base)
}

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
  const location = useLocation()
  const config = useConfig()
  const { allRoutes, currentRoute, currentLocale, isCollectionPage } =
    useRoutes()
  const i18n = config.i18n
  const { setLocale } = useBoltdocsContext()

  // Writes the store BEFORE navigating on purpose: the router re-adds the
  // active locale to out-of-basename targets (external pages) read from the
  // store within this same handler, and StoreSync reconciles the preference
  // once the navigation lands (it matches against the live browser URL, so
  // the optimistic write is never reverted mid-navigation).
  const handleLocaleChange = (locale: string) => {
    if (!i18n || locale === currentLocale) return

    setLocale(locale)

    const base = config.base || '/'
    const safeBase = base === '/' ? '' : base.replace(/\/$/, '')
    const isDocRoute = !!currentRoute?.filePath

    let targetPath = ''

    if (currentRoute) {
      if (isDocRoute && !currentRoute.collection && !isCollectionPage) {
        const baseFile = currentRoute.filePath
          ? getBaseFilePath(
              currentRoute.filePath,
              currentRoute.version,
              currentRoute.locale,
            )
          : ''

        const targetRoute = allRoutes.find(
          (r) =>
            r.filePath &&
            getBaseFilePath(r.filePath, r.version, r.locale) === baseFile &&
            (r.locale || i18n.defaultLocale) === locale &&
            r.version === currentRoute.version,
        )

        if (targetRoute) {
          targetPath = targetRoute.path
        } else {
          const defaultIndexRoute = allRoutes.find(
            (r) =>
              r.filePath &&
              ['index.md', '_index.md'].includes(
                getBaseFilePath(r.filePath, r.version, r.locale),
              ) &&
              (r.locale || i18n.defaultLocale) === locale &&
              r.version === currentRoute.version,
          )

          if (defaultIndexRoute) {
            targetPath = defaultIndexRoute.path
          } else {
            const vPath = currentRoute.version ? `/${currentRoute.version}` : ''
            const lPath = locale === i18n.defaultLocale ? '' : `/${locale}`
            targetPath = `${safeBase}${vPath}${lPath}` || '/'
          }
        }
      } else {
        // Use the shared parsing function for collection routes and external pages
        const contractConfig: UrlContractConfig = {
          base: config.base,
          i18n: config.i18n
            ? {
                defaultLocale: config.i18n.defaultLocale,
                locales: config.i18n.locales,
              }
            : undefined,
          versions: config.versions
            ? {
                defaultVersion: config.versions.defaultVersion,
                prefix: config.versions.prefix,
                versions: config.versions.versions,
              }
            : undefined,
          collections: currentRoute.collection ? [currentRoute.collection] : [],
        }
        targetPath = parsePathForLocaleSwitch(
          currentRoute.path || '',
          contractConfig,
          locale,
          i18n.defaultLocale,
          currentRoute.collection,
        )
      }
    } else {
      const currentPath = location.pathname

      if (isCollectionPage) {
        targetPath = currentPath
      } else {
        // Build contract config for path parsing utilities
        const contractConfig: UrlContractConfig = {
          base: config.base,
          i18n: config.i18n
            ? {
                defaultLocale: config.i18n.defaultLocale,
                locales: config.i18n.locales,
              }
            : undefined,
          versions: config.versions
            ? {
                defaultVersion: config.versions.defaultVersion,
                prefix: config.versions.prefix,
                versions: config.versions.versions,
              }
            : undefined,
          collections: [],
        }
        targetPath = parsePathForLocaleSwitch(
          currentPath,
          contractConfig,
          locale,
          i18n.defaultLocale,
        )
      }
    }

    if (!targetPath || targetPath === '') targetPath = '/'
    targetPath = targetPath.replace(/\/+/g, '/')

    // Skip navigation if the target path is the same as the current path
    // This handles collection root pages which are locale-independent
    const currentPath = currentRoute?.path || location.pathname
    if (targetPath !== currentPath) {
      navigate(targetPath)
    }
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
