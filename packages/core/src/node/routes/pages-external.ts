import fs from 'node:fs'
import path from 'node:path'
import type { BoltdocsConfig } from '../../shared/types'

/**
 * Reads the pages-external/index.{tsx,ts,jsx,js} file and extracts
 * the route keys from `export const pages = { ... }`.
 *
 * When i18n is active, also generates locale-prefixed variants
 * (e.g. `/es/showcase`).
 */
export function getExternalRoutePaths(
  docsDir: string,
  config?: BoltdocsConfig,
): string[] {
  const extensions = ['tsx', 'ts', 'jsx', 'js']
  const externalDir = path.resolve(docsDir, 'pages-external')
  const indexPath = extensions
    .map((ext) => path.resolve(externalDir, `index.${ext}`))
    .find((p) => fs.existsSync(p))

  if (!indexPath) return []

  const content = fs.readFileSync(indexPath, 'utf-8')
  const pagesMatch = content.match(
    /export\s+const\s+pages\s*=\s*\{([\s\S]*?)\}\s*(?:;|$)/,
  )

  if (!pagesMatch) return []

  const keys: string[] = []
  const keyRegex = /(['"])(.+?)\1\s*:/g
  let match: RegExpExecArray | null

  while ((match = keyRegex.exec(pagesMatch[1])) !== null) {
    const rawPath = match[2]
    const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
    keys.push(normalizedPath)

    if (config?.i18n) {
      const locales = Object.keys(config.i18n.locales)
      for (const locale of locales) {
        const localePath =
          normalizedPath === '/' ? `/${locale}` : `/${locale}${normalizedPath}`
        if (!keys.includes(localePath)) {
          keys.push(localePath)
        }
      }
    }
  }

  return keys
}
