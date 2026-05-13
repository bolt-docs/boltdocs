import { useNavigate } from 'react-router-dom'
import { getBaseFilePath } from '../utils/get-base-file-path'
import { useRoutes } from './use-routes'
import { useConfig } from '../app/config-context'
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
  const config = useConfig()
  const { allRoutes, currentRoute, currentVersion, currentLocale } = useRoutes()
  const versions = config.versions
  const { setVersion } = useBoltdocsContext()

  const handleVersionChange = (version: string) => {
    if (!versions || version === currentVersion) return

    // Update store
    setVersion(version)

    // 3. Attempt derivation or deployment of navigation target
    const base = config.base || '/docs'
    const safeBase = base.replace(/\/$/, '')
    let targetPath = `${safeBase}/${version}${currentLocale ? `/${currentLocale}` : ''}`

    if (currentRoute) {
      const baseFile = getBaseFilePath(
        currentRoute.filePath,
        currentRoute.version,
        currentRoute.locale,
      )

      const targetRoute = allRoutes.find(
        (r) =>
          getBaseFilePath(r.filePath, r.version, r.locale) === baseFile &&
          (r.version || versions.defaultVersion) === version &&
          (!config.i18n ||
            (r.locale || config.i18n.defaultLocale) === currentLocale),
      )

      if (targetRoute) {
        targetPath = targetRoute.path
      } else {
        const versionIndexRoute = allRoutes.find(
          (r) =>
            getBaseFilePath(r.filePath, r.version, r.locale) === 'index.md' &&
            (r.version || versions.defaultVersion) === version &&
            (!config.i18n ||
              (r.locale || config.i18n.defaultLocale) === currentLocale),
        )
        if (versionIndexRoute) {
          targetPath = versionIndexRoute.path
        }
      }
    } else {
      // Recovery mode: if currently on a 404, attempt to find ANY document in the target version
      const fallbackRoute = allRoutes.find(
        (r) =>
          (r.version || versions.defaultVersion) === version &&
          (!config.i18n ||
            (r.locale || config.i18n.defaultLocale) === currentLocale),
      )
      if (fallbackRoute) {
        targetPath = fallbackRoute.path
      }
    }

    navigate(targetPath)
  }

  const currentVersionConfig = versions?.versions?.find?.(
    (v) => v.path === currentVersion,
  )
  const currentVersionLabel = currentVersionConfig?.label || currentVersion

  const availableVersions = versions
    ? versions.versions.map((v) => ({
        key: v.path as BoltdocsVersion,
        label: v.label,
        value: v.path,
        isCurrent: v.path === currentVersion,
      }))
    : []

  return {
    currentVersion,
    currentVersionLabel,
    availableVersions,
    handleVersionChange,
  }
}
