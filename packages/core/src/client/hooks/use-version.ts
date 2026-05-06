import { useNavigate } from 'react-router-dom'
import { getBaseFilePath } from '../utils/get-base-file-path'
import { useRoutes } from './use-routes'
import { useBoltdocsContext } from '../store/boltdocs-context'
import type { BoltdocsVersion } from '../../shared/types'

export interface VersionOption {
  key: BoltdocsVersion
  label: string
  value: string
  isCurrent: boolean
}

export interface UseVersionReturn {
  currentVersion: BoltdocsVersion | undefined
  currentVersionLabel: string | undefined
  availableVersions: VersionOption[]
  handleVersionChange: (version: BoltdocsVersion) => void
}

/**
 * Hook to manage and switch between different versions of the documentation.
 */
export function useVersion(): UseVersionReturn {
  const navigate = useNavigate()
  const routeContext = useRoutes()
  const { allRoutes, currentRoute, currentVersion, currentLocale, config } =
    routeContext
  const versions = config.versions
  const { setVersion } = useBoltdocsContext()

  const handleVersionChange = (version: string) => {
    if (!versions || version === currentVersion) return

    // Update store
    setVersion(version)

    // If we are on the home page or a path that doesn't belong to the documentation,
    // we stay on the current page.
    const localePaths = config.i18n
      ? Object.keys(config.i18n.locales).map((l) => `/${l}`)
      : []
    const isHome =
      !currentRoute ||
      currentRoute.path === '/' ||
      currentRoute.path === config.base ||
      currentRoute.path === '' ||
      localePaths.includes(currentRoute.path)

    if (isHome) {
      return
    }

    if (currentRoute) {
      let targetPath = `/docs/${version}`
      const baseFile = getBaseFilePath(
        currentRoute.filePath,
        currentRoute.version,
        currentRoute.locale,
      )

      const targetRoute = allRoutes.find(
        (r) =>
          getBaseFilePath(r.filePath, r.version, r.locale) === baseFile &&
          (r.version || versions.defaultVersion) === version &&
          (currentLocale ? r.locale === currentLocale : !r.locale),
      )

      if (targetRoute) {
        targetPath = targetRoute.path
      } else {
        const versionIndexRoute = allRoutes.find(
          (r) =>
            getBaseFilePath(r.filePath, r.version, r.locale) === 'index.md' &&
            (r.version || versions.defaultVersion) === version &&
            (currentLocale ? r.locale === currentLocale : !r.locale),
        )
        targetPath = versionIndexRoute
          ? versionIndexRoute.path
          : `/docs/${version}${currentLocale ? `/${currentLocale}` : ''}`
      }

      navigate(targetPath)
    }
  }

  const availableVersions = routeContext.availableVersions.map((v) => ({
    ...v,
    label: v.label as string,
    value: v.key,
  }))

  return {
    currentVersion,
    currentVersionLabel: routeContext.currentVersionLabel,
    availableVersions,
    handleVersionChange,
  }
}
