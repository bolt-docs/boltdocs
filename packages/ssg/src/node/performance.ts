import fs from 'node:fs'
import path from 'node:path'
import { join } from 'node:path'
import type { Manifest, ManifestItem } from './build'

export interface PageMetric {
  route: string
  htmlSize: number
  htmlFile: string
}

export interface PerformanceMetrics {
  buildTime: number
  totalJSBundleSize: number
  totalCSSBundleSize: number
  totalImagesSize: number
  totalHTMLSize: number
  fontCount: number
  pages: PageMetric[]
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico'])
const FONT_EXTS = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot'])

function getFileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size
  } catch {
    return 0
  }
}

export async function collectPerformanceMetrics(
  outDir: string,
  buildTime: number,
): Promise<PerformanceMetrics> {
  const dotViteDir = join(outDir, '.vite')
  const assetsDir = join(outDir, 'assets')

  let manifest: Manifest = {}
  const manifestPath = join(dotViteDir, 'manifest.json')
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(await fs.readFileSync(manifestPath, 'utf-8'))
  }

  let totalJSBundleSize = 0
  let totalCSSBundleSize = 0

  for (const [, item] of Object.entries(manifest)) {
    const { file, css = [] } = item as ManifestItem
    const jsSize = getFileSize(join(outDir, file))
    totalJSBundleSize += jsSize

    for (const cssFile of css) {
      totalCSSBundleSize += getFileSize(join(outDir, cssFile))
    }
  }

  let totalImagesSize = 0
  let fontCount = 0
  if (fs.existsSync(assetsDir)) {
    const entries = fs.readdirSync(assetsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const ext = path.extname(entry.name).toLowerCase()
      const fullPath = join(assetsDir, entry.name)
      if (IMAGE_EXTS.has(ext)) {
        totalImagesSize += getFileSize(fullPath)
      } else if (FONT_EXTS.has(ext)) {
        fontCount++
      }
    }
  }

  const distIndex = join(outDir, 'index.html')
  let totalHTMLSize = 0
  const pages: PageMetric[] = []

  if (fs.existsSync(distIndex)) {
    const size = getFileSize(distIndex)
    totalHTMLSize += size
    pages.push({ route: '/', htmlSize: size, htmlFile: 'index.html' })
  }

  try {
    const distFiles = fs.readdirSync(outDir, { recursive: true }) as string[]
    for (const file of distFiles) {
      if (!file.endsWith('.html') || file === 'index.html') continue
      const fullPath = join(outDir, file)
      const size = getFileSize(fullPath)
      if (size > 0) {
        const route = '/' + file.replace(/\\/g, '/').replace(/\/index\.html$/, '').replace(/\.html$/, '')
        totalHTMLSize += size
        pages.push({ route, htmlSize: size, htmlFile: file })
      }
    }
  } catch {
    // recursive readdir may fail on some Node versions; skip per-page
  }

  return {
    buildTime,
    totalJSBundleSize,
    totalCSSBundleSize,
    totalImagesSize,
    totalHTMLSize,
    fontCount,
    pages,
  }
}

export function writePerformanceMetrics(
  outDir: string,
  metrics: PerformanceMetrics,
) {
  const reportsDir = path.resolve(outDir, '..', '.boltdocs', 'reports')
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true })
  }
  const filePath = join(reportsDir, 'performance.json')
  fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2))
}
