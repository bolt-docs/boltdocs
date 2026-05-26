import path from 'node:path'
import fs from 'node:fs'
import { fdir } from 'fdir'
import {
  parseFrontmatter,
  parseFrontmatterAsync,
  fileToRoutePath,
} from '../../utils'
import type { BoltdocsConfig } from '../../config'
import {
  type DoctorConfig,
  DEFAULT_DOCTOR_CONFIG,
  type DoctorContext,
} from './types'
import { warn } from '@bdocs/dui'

export function parseBudget(value: string | number | undefined, defaultVal: number): number {
  if (value === undefined || value === null) return defaultVal
  if (typeof value === 'number') return value
  const match = value.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/)
  if (!match) return defaultVal
  const num = Number.parseFloat(match[1])
  const unit = match[2] || 'b'
  const multipliers: Record<string, number> = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 }
  return Math.round(num * (multipliers[unit] || 1))
}

export function getSeverity(
  ctx: DoctorContext,
  type: string,
  defaultLevel: 'high' | 'warning' | 'low',
): 'high' | 'warning' | 'low' | 'off' {
  return ctx.doctorConfig.severity[type] || defaultLevel
}

export async function backupFile(filePath: string, backupDir: string) {
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
  const fileName = path.basename(filePath)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(backupDir, `${fileName}.${timestamp}.bak`)
  fs.copyFileSync(filePath, backupPath)
}

export const fileCache = new Map<
  string,
  Promise<{ raw: string; data: Record<string, any>; content: string }>
>()

export function getFileData(
  filePath: string,
): Promise<{ raw: string; data: Record<string, any>; content: string }> {
  const cached = fileCache.get(filePath)
  if (cached) return cached

  const promise = (async () => {
    const parsed = await parseFrontmatterAsync(filePath, false)
    return { raw: parsed.raw, data: parsed.data, content: parsed.content }
  })()

  fileCache.set(filePath, promise)
  return promise
}

export const fileExistsCache = new Map<string, boolean>()

export function cachedExists(filePath: string): boolean {
  if (fileExistsCache.has(filePath)) return fileExistsCache.get(filePath)!
  let exists = false
  try {
    exists = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
  } catch {
    exists = false
  }
  fileExistsCache.set(filePath, exists)
  return exists
}

export async function loadDoctorConfig(root: string): Promise<DoctorConfig> {
  const configPath = path.resolve(root, 'doctor.json')
  if (fs.existsSync(configPath)) {
    try {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      return {
        ...DEFAULT_DOCTOR_CONFIG,
        ...userConfig,
        checks: {
          ...DEFAULT_DOCTOR_CONFIG.checks,
          ...userConfig.checks,
          metadata: {
            ...DEFAULT_DOCTOR_CONFIG.checks.metadata,
            ...userConfig.checks?.metadata,
          },
          links: {
            ...DEFAULT_DOCTOR_CONFIG.checks.links,
            ...userConfig.checks?.links,
          },
          i18n: {
            ...DEFAULT_DOCTOR_CONFIG.checks.i18n,
            ...userConfig.checks?.i18n,
          },
          performance: {
            ...DEFAULT_DOCTOR_CONFIG.checks.performance,
            ...userConfig.checks?.performance,
            budgets: {
              ...DEFAULT_DOCTOR_CONFIG.checks.performance?.budgets,
              ...userConfig.checks?.performance?.budgets,
            },
          },
        },
        fix: { ...DEFAULT_DOCTOR_CONFIG.fix, ...userConfig.fix },
        reporting: {
          ...DEFAULT_DOCTOR_CONFIG.reporting,
          ...userConfig.reporting,
        },
        severity: { ...DEFAULT_DOCTOR_CONFIG.severity, ...userConfig.severity },
        exclude: [
          ...DEFAULT_DOCTOR_CONFIG.exclude,
          ...(userConfig.exclude || []),
        ],
      }
    } catch (e) {
      warn(`Failed to parse doctor.json: ${e}`)
    }
  }
  return DEFAULT_DOCTOR_CONFIG
}

export async function generateLinkTree(
  docsDir: string,
  root: string = process.cwd(),
  config?: BoltdocsConfig,
  existingFiles?: string[],
): Promise<any> {
  const dotBoltdocsDir = path.resolve(root, '.boltdocs')
  if (!fs.existsSync(dotBoltdocsDir)) {
    fs.mkdirSync(dotBoltdocsDir, { recursive: true })
  }

  let files = existingFiles
  if (!files) {
    const api = new fdir()
      .withFullPaths()
      .filter((p) => p.endsWith('.md') || p.endsWith('.mdx'))
      .crawl(docsDir)

    files = await api.withPromise()
  }

  const base = config?.base || '/docs'
  const routes: string[] = []

  const CHUNK_SIZE = 100
  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE)
    const chunkRoutes = await Promise.all(
      chunk.map(async (file) => {
        const absFile = path.isAbsolute(file)
          ? file
          : path.resolve(docsDir, file)
        const relFile = path.relative(docsDir, absFile)

        const { data } = await getFileData(absFile)
        let route: string
        if (data.permalink) {
          route = data.permalink.startsWith('/')
            ? data.permalink
            : `/${data.permalink}`
        } else {
          route = fileToRoutePath(relFile)
        }

        if (base === '/') return route
        return (
          // Use template literal to construct the route and removed concatenations

          (base.endsWith('/') ? base : base + '/') +
          (route.startsWith('/') ? route.substring(1) : route)
        )
      }),
    )
    routes.push(...chunkRoutes)
  }

  if (!routes.includes(base)) routes.push(base)

  const tree = {
    routes: Array.from(new Set(routes)).sort(),
    timestamp: Date.now(),
  }

  fs.writeFileSync(
    path.resolve(dotBoltdocsDir, 'link-tree.json'),
    JSON.stringify(tree, null, 2),
  )

  return tree
}
