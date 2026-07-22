import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { normalizePath } from '../utils'

type NodeRequire = ReturnType<typeof createRequire>

const req = createRequire(import.meta.url)
const EXTERNALS = [
  'react',
  'react-dom',
  'react-router-dom',
  'react-helmet-async',
  '@bdocs/ssg',
]
const SUBPATHS = [
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom/client',
]

export function getBaseRequire(defaultReq: NodeRequire = req): NodeRequire {
  try {
    const pkgJsonPath = path.join(
      process.cwd(),
      'node_modules/boltdocs/package.json',
    )
    if (fs.existsSync(pkgJsonPath)) {
      return createRequire(fs.realpathSync(pkgJsonPath))
    }
    return createRequire(path.join(process.cwd(), 'package.json'))
  } catch {
    return defaultReq
  }
}

export function resolveEsm(packageName: string, customReq = req): string {
  try {
    const parts = packageName.split('/')
    const pkgName = packageName.startsWith('@')
      ? parts.slice(0, 2).join('/')
      : parts[0]
    const subpath = packageName.startsWith('@')
      ? parts.slice(2).join('/')
      : parts.slice(1).join('/')

    let pkgJsonPath = ''
    try {
      pkgJsonPath = customReq.resolve(`${pkgName}/package.json`)
    } catch {
      const resolvedEntry = customReq.resolve(pkgName)
      let dir = path.dirname(resolvedEntry)
      while (dir && dir !== path.dirname(dir)) {
        const target = path.join(dir, 'package.json')
        if (fs.existsSync(target)) {
          pkgJsonPath = target
          break
        }
        dir = path.dirname(dir)
      }
    }

    if (!pkgJsonPath) throw new Error()

    const pkgDir = path.dirname(pkgJsonPath)
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
    const exportKey = subpath ? `./${subpath}` : '.'
    let relativePath = pkg.exports?.[exportKey] || pkg.exports?.[subpath] || ''

    if (typeof relativePath === 'object' && relativePath !== null) {
      relativePath =
        relativePath.import ||
        relativePath.default ||
        relativePath.require ||
        ''
    }
    if (!relativePath && !subpath) {
      relativePath = pkg.module || pkg.main || 'index.js'
    }

    const resolved = path.resolve(pkgDir, relativePath as string)
    if (fs.existsSync(resolved)) return resolved
  } catch {
    // Fallback
  }
  return customReq.resolve(packageName)
}

export function getExternalAbsolutePaths(customReq = req): string[] {
  const paths: string[] = []
  const baseReq = getBaseRequire(customReq)
  const loaders = new Set([baseReq, customReq])

  for (const loader of loaders) {
    for (const ext of EXTERNALS) {
      try {
        const isEsmTarget = [
          '@bdocs/ssg',
          'react-router-dom',
          'react-helmet-async',
        ].includes(ext)
        const resolved = isEsmTarget
          ? resolveEsm(ext, loader)
          : loader.resolve(ext)
        if (resolved) paths.push(fs.realpathSync(resolved))
      } catch {}
    }
    for (const sub of SUBPATHS) {
      try {
        paths.push(fs.realpathSync(loader.resolve(sub)))
      } catch {}
    }
  }

  return Array.from(new Set(paths)).map((p) => normalizePath(p))
}
