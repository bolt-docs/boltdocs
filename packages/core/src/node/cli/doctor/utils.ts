import path from 'path'
import fs from 'fs'
import fastGlob from 'fast-glob'
import { parseFrontmatter, fileToRoutePath } from '../../utils'
import type { BoltdocsConfig } from '../../config'
import {
  type DoctorConfig,
  DEFAULT_DOCTOR_CONFIG,
  type DoctorContext,
} from './types'
import * as ui from '../ui'

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
    const parsed = parseFrontmatter(filePath, false)
    return { raw: parsed.raw, data: parsed.data, content: parsed.content }
  })()

  fileCache.set(filePath, promise)
  return promise
}

const fileExistsCache = new Map<string, boolean>()

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
      ui.warn(`Failed to parse doctor.json: ${e}`)
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

  const files =
    existingFiles ||
    (await fastGlob(['**/*.md', '**/*.mdx'], {
      cwd: docsDir,
      absolute: false,
      suppressErrors: true,
    }))

  const base = config?.base || '/docs'
  const routes = await Promise.all(
    files.map(async (file) => {
      const absFile = path.isAbsolute(file) ? file : path.resolve(docsDir, file)
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
        (base.endsWith('/') ? base : base + '/') +
        (route.startsWith('/') ? route.substring(1) : route)
      )
    }),
  )

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
