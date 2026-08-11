import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'

export interface SampleStats {
  samples: number[]
  count: number
  min: number
  max: number
  mean: number
  median: number
  p95: number
  standardDeviation: number
}

export interface OutputCategory {
  bytes: number
  files: number
}

export interface OutputBreakdown {
  total: OutputCategory
  javascript: OutputCategory
  css: OutputCategory
  html: OutputCategory
  images: OutputCategory
  fonts: OutputCategory
  other: OutputCategory
  compressed: {
    gzipBytes: number
    brotliBytes: number
  }
  /** SHA-256 of sorted relative paths and file bytes in the deployable output. */
  contentDigest: string
  htmlPages: number
}

export interface BenchmarkEnvironment {
  nodeVersion: string
  platform: string
  arch: string
  cpuModel: string
  cpuCores: number
  totalMemoryBytes: number
}

export type BenchmarkCacheMode =
  | 'cold-framework'
  | 'warm-framework'
  | 'incremental-framework'

export interface BenchmarkCacheState {
  mode: BenchmarkCacheMode
  clearedPaths: string[]
  preservedPaths: string[]
  dependencyCache: 'shared' | 'isolated' | 'unknown'
  limitations: string[]
}

/**
 * Describe cache state without pretending that a symlinked node_modules tree
 * is isolated. The baseline sandbox deliberately reuses dependencies so the
 * report measures framework caches separately from dependency installation.
 */
export function describeCacheState(
  sandbox: string,
  mode: BenchmarkCacheMode,
): BenchmarkCacheState {
  const nodeModules = path.join(sandbox, 'node_modules')
  let dependencyCache: BenchmarkCacheState['dependencyCache'] = 'unknown'
  try {
    dependencyCache = fs.lstatSync(nodeModules).isSymbolicLink()
      ? 'shared'
      : 'isolated'
  } catch {
    // Keep the limitation explicit if the dependency tree is unavailable.
  }

  return {
    mode,
    clearedPaths:
      mode === 'cold-framework' ? ['dist', '.boltdocs', '.cache', '.vite'] : [],
    preservedPaths: [
      'node_modules',
      'node_modules/.vite',
      'node_modules/.cache',
    ],
    dependencyCache,
    limitations: [
      'Dependency installation and package-manager caches are not part of this measurement.',
      'A shared node_modules tree means bundler caches inside node_modules are preserved.',
    ],
  }
}

export function summarizeSamples(values: readonly number[]): SampleStats {
  const samples = [...values].sort((a, b) => a - b)
  if (samples.length === 0) {
    return {
      samples: [],
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p95: 0,
      standardDeviation: 0,
    }
  }

  const percentile = (percent: number): number => {
    const index = Math.max(0, Math.ceil((percent / 100) * samples.length) - 1)
    return samples[Math.min(index, samples.length - 1)]
  }
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
  const variance =
    samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    samples.length

  return {
    samples,
    count: samples.length,
    min: samples[0],
    max: samples[samples.length - 1],
    mean,
    median:
      samples.length % 2 === 0
        ? (samples[samples.length / 2 - 1] + samples[samples.length / 2]) / 2
        : samples[Math.floor(samples.length / 2)],
    p95: percentile(95),
    standardDeviation: Math.sqrt(variance),
  }
}

function category(): OutputCategory {
  return { bytes: 0, files: 0 }
}

function addFile(target: OutputCategory, bytes: number): void {
  target.bytes += bytes
  target.files++
}

function extensionCategory(
  filePath: string,
): keyof Pick<
  OutputBreakdown,
  'javascript' | 'css' | 'html' | 'images' | 'fonts' | 'other'
> {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.js' || extension === '.mjs' || extension === '.cjs') {
    return 'javascript'
  }
  if (extension === '.css') return 'css'
  if (extension === '.html') return 'html'
  if (
    new Set([
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.svg',
      '.webp',
      '.avif',
      '.ico',
    ]).has(extension)
  ) {
    return 'images'
  }
  if (new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot']).has(extension)) {
    return 'fonts'
  }
  return 'other'
}

export function collectOutputBreakdown(rootDir: string): OutputBreakdown {
  const breakdown: OutputBreakdown = {
    total: category(),
    javascript: category(),
    css: category(),
    html: category(),
    images: category(),
    fonts: category(),
    other: category(),
    compressed: { gzipBytes: 0, brotliBytes: 0 },
    contentDigest: '',
    htmlPages: 0,
  }
  const files: Array<{ relativePath: string; bytes: Buffer }> = []

  function visit(directory: string): void {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        visit(filePath)
        continue
      }
      if (!entry.isFile()) continue
      let bytes: Buffer
      try {
        bytes = fs.readFileSync(filePath)
      } catch {
        continue
      }
      const size = bytes.byteLength
      const kind = extensionCategory(filePath)
      addFile(breakdown.total, size)
      addFile(breakdown[kind], size)
      if (kind === 'html') breakdown.htmlPages++
      files.push({
        relativePath: path
          .relative(rootDir, filePath)
          .split(path.sep)
          .join('/'),
        bytes,
      })
    }
  }

  if (fs.existsSync(rootDir)) visit(rootDir)
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  const digest = crypto.createHash('sha256')
  const orderedContents: Buffer[] = []
  for (const file of files) {
    digest.update(file.relativePath)
    digest.update('\0')
    digest.update(file.bytes)
    orderedContents.push(file.bytes)
  }
  const allContent = Buffer.concat(orderedContents)
  breakdown.contentDigest = digest.digest('hex')
  breakdown.compressed.gzipBytes = gzipSync(allContent, { level: 9 }).byteLength
  breakdown.compressed.brotliBytes = brotliCompressSync(allContent).byteLength
  return breakdown
}

export function normalizeDevRoute(route: string): string {
  const trimmed = route.trim()
  if (!trimmed || trimmed === '/') return '/'
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`
}

/**
 * Detect a literal `base` from a Boltdocs config for the dev smoke request.
 * Dynamic expressions intentionally fall back to `/`; callers can use
 * `--route` when a project computes its base at runtime.
 */
export function findConfiguredDevRoute(source: string): string {
  const match = source.match(/\bbase\s*:\s*['"]([^'"]+)['"]/)
  return match?.[1] ? normalizeDevRoute(match[1]) : '/'
}

export function getBenchmarkEnvironment(): BenchmarkEnvironment {
  return {
    nodeVersion: process.version,
    platform: `${os.platform()} ${os.release()}`,
    arch: os.arch(),
    cpuModel: os.cpus()[0]?.model || 'Unknown',
    cpuCores: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
  }
}
