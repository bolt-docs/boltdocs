import { dirname, relative, sep } from 'node:path'
import fs from 'fs-extra'
import { withLeadingSlash } from '../utils/path'

export interface SsgOutputState {
  cacheHash: string
  clientFiles: string[]
  pageFiles: string[]
  auxiliaryFiles: string[]
}

export function createSsgOutputState(
  cacheHash: string,
  clientFiles: readonly string[],
  pageFiles: readonly string[],
  auxiliaryFiles: readonly string[] = [],
): SsgOutputState {
  return {
    cacheHash,
    clientFiles: [...new Set(clientFiles)].sort(),
    pageFiles: [...new Set(pageFiles)].sort(),
    auxiliaryFiles: [...new Set(auxiliaryFiles)].sort(),
  }
}

export function isSsgOutputReusable(
  state: SsgOutputState | undefined,
  cacheHash: string,
  outDir: string,
  expectedClientFiles: readonly string[],
  expectedPageFiles: readonly string[],
  expectedAuxiliaryFiles: readonly string[] = state?.auxiliaryFiles || [],
): boolean {
  if (!state || state.cacheHash !== cacheHash) return false

  const sameFiles = (left: readonly string[], right: readonly string[]) => {
    if (left.length !== right.length) return false
    return left.every((file, index) => file === right[index])
  }

  const clientFiles = [...new Set(expectedClientFiles)].sort()
  const pageFiles = [...new Set(expectedPageFiles)].sort()
  const auxiliaryFiles = [...new Set(expectedAuxiliaryFiles)].sort()
  if (!sameFiles(state.clientFiles, clientFiles)) return false
  if (!sameFiles(state.pageFiles, pageFiles)) return false
  if (!sameFiles(state.auxiliaryFiles || [], auxiliaryFiles)) return false

  const expectedFiles = [...clientFiles, ...pageFiles, ...auxiliaryFiles]
  if (!sameFiles(listOutputFiles(outDir), [...new Set(expectedFiles)].sort())) {
    return false
  }

  return expectedFiles.every((file) => fs.existsSync(`${outDir}/${file}`))
}

export function isClientCacheReusable(
  state: SsgOutputState | undefined,
  actualClientFiles: readonly string[],
  excludedFile?: string,
): boolean {
  if (!state) return false

  const expected = state.clientFiles
    .filter((file) => file !== excludedFile)
    .sort()
  const actual = actualClientFiles
    .filter((file) => file !== excludedFile)
    .sort()

  return (
    expected.length === actual.length &&
    expected.every((file, index) => file === actual[index])
  )
}

export async function readSsgOutputState(
  filePath: string,
): Promise<SsgOutputState | undefined> {
  try {
    const state = await fs.readJson(filePath)
    if (
      !state ||
      typeof state.cacheHash !== 'string' ||
      !Array.isArray(state.clientFiles) ||
      !Array.isArray(state.pageFiles) ||
      !Array.isArray(state.auxiliaryFiles) ||
      state.clientFiles.some((file: unknown) => typeof file !== 'string') ||
      state.pageFiles.some((file: unknown) => typeof file !== 'string') ||
      state.auxiliaryFiles.some((file: unknown) => typeof file !== 'string')
    ) {
      return undefined
    }
    return createSsgOutputState(
      state.cacheHash,
      state.clientFiles,
      state.pageFiles,
      state.auxiliaryFiles,
    )
  } catch {
    return undefined
  }
}

export async function writeSsgOutputState(
  filePath: string,
  cacheHash: string,
  outDir: string,
  pageFiles: readonly string[],
  clientFiles: readonly string[] = [],
  outputFiles?: readonly string[],
): Promise<boolean> {
  const resolvedOutputFiles = outputFiles || listOutputFiles(outDir)
  const pageFileSet = new Set(pageFiles)
  const clientFileSet = new Set(clientFiles)
  const resolvedClientFiles =
    clientFiles.length > 0
      ? [...clientFileSet]
      : resolvedOutputFiles.filter((file) => !pageFileSet.has(file))
  const auxiliaryFiles =
    clientFiles.length > 0
      ? resolvedOutputFiles.filter(
          (file) => !pageFileSet.has(file) && !clientFileSet.has(file),
        )
      : []
  const state = createSsgOutputState(
    cacheHash,
    resolvedClientFiles,
    pageFiles,
    auxiliaryFiles,
  )
  return writeJsonIfChanged(filePath, state)
}

export function getSsgOutputPageFiles(
  routes: readonly string[],
  cache: Record<string, { loaderDataFilePath?: string }>,
  dirStyle: 'flat' | 'nested',
): string[] {
  const files: string[] = []
  for (const route of routes) {
    const routePrefix = route.replace(/^\/+/, '').replace(/\/+$/, '')
    const filename =
      dirStyle === 'nested'
        ? `${routePrefix ? `${routePrefix}/` : ''}index.html`
        : `${(route.endsWith('/') ? `${route}index` : route).replace(/^\/+/, '')}.html`
    files.push(filename)

    const key = getCanonicalRouteKey(route)
    const loaderDataPath = cache[key]?.loaderDataFilePath
    if (loaderDataPath) files.push(loaderDataPath)
  }

  return [...new Set(files)]
}

export function listOutputFiles(rootDir: string): string[] {
  const files: string[] = []

  const visit = (directory: string) => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name === '.vite') continue
      const absolute = `${directory}/${entry.name}`
      if (entry.isDirectory()) {
        visit(absolute)
      } else if (entry.isFile()) {
        files.push(relative(rootDir, absolute).split(sep).join('/'))
      }
    }
  }

  visit(rootDir)
  return files.sort()
}

export function getCanonicalRouteKey(routePath: string): string {
  if (!routePath || routePath === '/') return ''
  return withLeadingSlash(routePath).replace(/\/+$/, '')
}

export function reconcileRouteCache<T>(
  cache: Record<string, T>,
  activeRoutes: readonly string[],
): Record<string, T> {
  const activeKeys = new Set(activeRoutes.map(getCanonicalRouteKey))
  const reconciled: Record<string, T> = {}

  for (const [key, value] of Object.entries(cache)) {
    const canonicalKey = getCanonicalRouteKey(key)
    if (activeKeys.has(canonicalKey)) {
      reconciled[canonicalKey] = value
    }
  }

  return reconciled
}

/**
 * Write text only when the destination content differs. Returns true when the
 * file was actually written.
 */
export async function writeFileIfChanged(
  filePath: string,
  content: string,
): Promise<boolean> {
  try {
    if ((await fs.readFile(filePath, 'utf8')) === content) return false
  } catch {
    // Missing or unreadable files are written below.
  }

  await fs.ensureDir(dirname(filePath))
  await fs.writeFile(filePath, content, 'utf8')
  return true
}

/**
 * Persist JSON only when its serialized value differs from the existing JSON.
 * This avoids mtime churn and redundant writes on warm builds.
 */
export async function writeJsonIfChanged(
  filePath: string,
  value: unknown,
  spaces: number = 2,
): Promise<boolean> {
  try {
    const current = await fs.readJson(filePath)
    if (JSON.stringify(current) === JSON.stringify(value)) return false
  } catch {
    // Missing or malformed files are replaced below.
  }

  await fs.ensureDir(dirname(filePath))
  await fs.writeJson(filePath, value, { spaces })
  return true
}
