import { useMemo } from 'react'
import { useLocation, useNavigate } from '../router'
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
  const location = useLocation()
  const config = useConfig()
  const { allRoutes, currentRoute, currentLocale, isCollectionPage } =
    useRoutes()
  const i18n = config.i18n
  const { setLocale } = useBoltdocsContext()

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
        let rawExternal = currentRoute.path || ''

        const parts = rawExternal.split('/').filter(Boolean)
        const localePosition = currentRoute.collection ? 1 : 0

        if (
          parts.length > localePosition &&
          (Array.isArray(i18n.locales)
            ? i18n.locales.includes(parts[localePosition])
            : !!i18n.locales[parts[localePosition]])
        ) {
          parts.splice(localePosition, 1)
          rawExternal = '/' + parts.join('/')
        }

        const cleanParts = rawExternal.split('/').filter(Boolean)
        if (locale === i18n.defaultLocale) {
          targetPath = rawExternal === '' ? '/' : rawExternal
        } else {
          cleanParts.splice(localePosition, 0, locale)
          targetPath = '/' + cleanParts.join('/') || '/'
        }
      }
    } else {
      const currentPath = location.pathname

      if (isCollectionPage) {
        targetPath = currentPath
      } else {
        const parts = currentPath.split('/').filter(Boolean)

        if (
          parts.length > 0 &&
          (Array.isArray(i18n.locales)
            ? i18n.locales.includes(parts[0])
            : !!i18n.locales[parts[0]])
        ) {
          parts.shift()
        }

        if (locale !== i18n.defaultLocale) {
          parts.unshift(locale)
        }

        targetPath = '/' + parts.join('/')
      }
    }

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
