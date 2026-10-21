function withBase(path: string, config: { base?: string }): string {
  const base = config.base || '/'
  if (path.startsWith(base)) return path
  const b = base === '/' ? '' : base.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${b}${p}` || '/'
}

function buildModuleMap(mdxModules: Record<string, any>): Map<string, string> {
  const moduleMap = new Map<string, string>()
  const mdxModuleKeys = Object.keys(mdxModules)

  if (mdxModuleKeys.length > 0) {
    const firstKeyNormalized = mdxModuleKeys[0].replace(/\\/g, '/')
    const parts = firstKeyNormalized.split('/').filter(Boolean)
    const docsDirName = parts[0] || 'docs'
    const primaryPrefix = `/${docsDirName}/`
    const altPrefix = `./${docsDirName}/`

    for (const rawKey of mdxModuleKeys) {
      const k = rawKey.replace(/\\/g, '/')
      let relativePath = ''
      if (k.indexOf(primaryPrefix) !== -1) {
        relativePath = k.substring(
          k.indexOf(primaryPrefix) + primaryPrefix.length,
        )
      } else if (k.startsWith(altPrefix)) {
        relativePath = k.substring(altPrefix.length)
      }

      if (relativePath) {
        moduleMap.set(relativePath, rawKey)
      } else {
        moduleMap.set(k, rawKey)
      }
    }
  }

  return moduleMap
}

function cleanModulePath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/\([^)]+\)/g, '')
    .replace(/^\([^)]+\)\//, '')
}

/**
 * Resolves a route source path against both Vite glob keys and relative keys.
 * Exact cleaned matches are preferred so `es/guide.md` cannot select the
 * default-locale `guide.md` when both modules are present.
 */
function resolveModuleKey(
  filePath: string,
  moduleMap: Map<string, string>,
): string | undefined {
  const normalized = filePath.replace(/\\/g, '/')
  const cleanPath = cleanModulePath(normalized)

  for (const candidate of [
    normalized,
    normalized.replace(/^\//, ''),
    cleanPath,
  ]) {
    const direct = moduleMap.get(candidate)
    if (direct) return direct
  }

  for (const [relativePath, moduleKey] of moduleMap.entries()) {
    const cleanRelative = cleanModulePath(relativePath)
    if (
      normalized.endsWith(relativePath) ||
      relativePath.endsWith(normalized) ||
      cleanPath.endsWith(cleanRelative) ||
      cleanRelative.endsWith(cleanPath)
    ) {
      return moduleKey
    }
  }

  return undefined
}

export { withBase, buildModuleMap, resolveModuleKey }
